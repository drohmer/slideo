import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, checkWriteAccess } from '../auth.js';
import { validateId } from '../validation.js';
import { safeFetch, SafeFetchError } from '../ssrf.js';
import { parsePptx, PptxParseError, type ParsedPptx } from '../pptx-parser.js';
import { convertPptxToSlides } from '../pptx-to-slideo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data/presentations');
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export const presentationsRouter = Router();

presentationsRouter.use(authenticate);
// validateId is applied per-route on paths that take a UUID, so static paths like
// /import-from-url aren't mistakenly rejected as "Invalid id".

interface StoredPresentation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  slides: unknown[];
  ownerId?: string;
  anonymous?: true;
  editToken?: string;
  expiresAt?: string;
  shareToken?: string;
}

function readPresentation(id: string): StoredPresentation | null {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writePresentation(id: string, data: StoredPresentation) {
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(data, null, 2));
}

function stripSecrets(obj: StoredPresentation): Omit<StoredPresentation, 'editToken' | 'shareToken'> {
  const { editToken: _t, shareToken: _s, ...rest } = obj;
  return rest;
}

// List presentations
presentationsRouter.get('/', (_req, res) => {
  if (!_req.user) {
    res.json([]);
    return;
  }
  const userId = _req.user.id;
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const presentations = files
    .map(f => {
      try {
        const data: StoredPresentation = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
        return data;
      } catch {
        return null;
      }
    })
    .filter((d): d is StoredPresentation => d !== null && d.ownerId === userId)
    .map(d => ({ id: d.id, title: d.title, createdAt: d.createdAt, updatedAt: d.updatedAt, ownerId: d.ownerId }));
  presentations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(presentations);
});

// Get a presentation
presentationsRouter.get('/:id', validateId, (req, res) => {
  const data = readPresentation(req.params.id);
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(stripSecrets(data));
});

// Create a presentation
presentationsRouter.post('/', (req, res) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const rawTitle = req.body?.title;
  const base = {
    id,
    title: typeof rawTitle === 'string' ? rawTitle.slice(0, 200) : 'Sans titre',
    createdAt: now,
    updatedAt: now,
    slides: [{ id: uuidv4(), background: '#ffffff', elements: [] }],
  };

  const shareToken = uuidv4();
  let presentation: StoredPresentation;
  if (req.user) {
    presentation = { ...base, ownerId: req.user.id, shareToken };
  } else {
    const editToken = uuidv4();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    presentation = { ...base, anonymous: true, editToken, expiresAt, shareToken };
  }

  fs.mkdirSync(path.join(UPLOADS_DIR, id), { recursive: true });
  writePresentation(id, presentation);
  res.status(201).json(presentation);
});

// Import from a Google Slides URL — fetches PPTX export and parses it.
// Public-share URLs only (Anyone with the link). Requires authenticated user
// (anonymous would create a 48h-expiring presentation; we keep parity with POST /).
const GOOGLE_SLIDES_RE = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;
const PPTX_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

presentationsRouter.post('/import-from-url', async (req, res) => {
  const { url, slideIndex } = req.body as { url?: string; slideIndex?: number };
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url required', code: 'invalidUrl' }); return;
  }
  // Validate slideIndex: positive integer or undefined
  let slideIndices: number[] | undefined;
  if (slideIndex != null) {
    const n = Number(slideIndex);
    if (!Number.isInteger(n) || n < 1) {
      res.status(400).json({ error: 'slideIndex must be a positive integer', code: 'invalidSlideIndex' }); return;
    }
    slideIndices = [n];
  }
  const m = GOOGLE_SLIDES_RE.exec(url);
  if (!m) {
    res.status(400).json({ error: 'Not a Google Slides URL', code: 'notGoogleSlides' }); return;
  }
  const slidesId = m[1];
  const exportUrl = `https://docs.google.com/presentation/d/${slidesId}/export/pptx`;

  let buffer: Buffer;
  try {
    // Google's /export/pptx endpoint typically 307-redirects to a *.googleusercontent.com host
    // that actually serves the file. Both hops are validated against the allowlist below.
    const result = await safeFetch(exportUrl, {
      allowedHosts: ['docs.google.com', '*.googleusercontent.com'],
      maxBytes: PPTX_MAX_BYTES,
      timeoutMs: 30_000,
      maxRedirects: 3,
    });
    buffer = result.buffer;
  } catch (e) {
    if (e instanceof SafeFetchError) {
      // Google returns 401/403 for restricted, 404 for private-or-missing — all map to "shareRequired".
      // A manual 3xx redirect from Google typically signals an auth wall.
      if (e.code === 'forbidden' || e.code === 'redirect' || /Remote returned 404/.test(e.message)) {
        res.status(403).json({ error: 'Document not accessible — make sure it is shared publicly', code: 'shareRequired' });
        return;
      }
      res.status(e.status).json({ error: e.message, code: e.code }); return;
    }
    res.status(500).json({ error: 'Fetch failed', code: 'fetchFailed' }); return;
  }

  // Some Google responses still return 200 with an HTML login page when the doc is private.
  // Detect that by sniffing the first bytes (PPTX always starts with "PK" — ZIP magic).
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    res.status(403).json({ error: 'Document not accessible — make sure it is shared publicly', code: 'shareRequired' });
    return;
  }

  // Create the presentation shell first (so we have an upload dir for media).
  const id = uuidv4();
  const uploadDir = path.join(UPLOADS_DIR, id);
  fs.mkdirSync(uploadDir, { recursive: true });

  let parsed: ParsedPptx;
  try {
    parsed = await parsePptx(buffer);
  } catch (e) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
    if (e instanceof PptxParseError) {
      res.status(422).json({ error: e.message, code: 'parseFailed' }); return;
    }
    res.status(500).json({ error: 'Parsing failed', code: 'parseFailed' }); return;
  }

  let slides: unknown[];
  let failedVideos: { title: string; reason: string }[] = [];
  try {
    const result = await convertPptxToSlides(parsed, {
      uploadDir,
      uploadUrlPrefix: `/uploads/${id}/`,
      slideIndices,
    });
    slides = result.slides;
    failedVideos = result.failedVideos;
  } catch {
    fs.rmSync(uploadDir, { recursive: true, force: true });
    res.status(500).json({ error: 'Conversion failed', code: 'conversionFailed' }); return;
  }

  const now = new Date().toISOString();
  const title = parsed.title?.slice(0, 200) || 'Présentation importée';
  const shareToken = uuidv4();
  let presentation: StoredPresentation;
  if (req.user) {
    presentation = {
      id, title, createdAt: now, updatedAt: now, slides,
      ownerId: req.user.id, shareToken,
    };
  } else {
    const editToken = uuidv4();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    presentation = {
      id, title, createdAt: now, updatedAt: now, slides,
      anonymous: true, editToken, expiresAt, shareToken,
    };
  }
  writePresentation(id, presentation);
  res.status(201).json({ ...presentation, warnings: { failedVideos } });
});

// Get share token (requires write access)
presentationsRouter.get('/:id/share-token', validateId, (req, res) => {
  const existing = readPresentation(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkWriteAccess(existing, req, res)) return;
  res.json({ shareToken: existing.shareToken });
});

// Update a presentation
presentationsRouter.put('/:id', validateId, (req, res) => {
  const existing = readPresentation(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkWriteAccess(existing, req, res)) return;

  const { title, slides } = req.body ?? {};
  const now = new Date().toISOString();
  const updated: StoredPresentation = {
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
    title: typeof title === 'string' ? title.slice(0, 200) : existing.title,
    slides: Array.isArray(slides) ? slides : existing.slides,
    ...(existing.ownerId ? { ownerId: existing.ownerId } : {}),
    ...(existing.anonymous ? {
      anonymous: true,
      editToken: existing.editToken,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    } : {}),
    ...(existing.shareToken ? { shareToken: existing.shareToken } : {}),
  };
  writePresentation(req.params.id, updated);
  res.json(stripSecrets(updated));
});

// Delete a presentation
presentationsRouter.delete('/:id', validateId, (req, res) => {
  const existing = readPresentation(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkWriteAccess(existing, req, res)) return;

  fs.unlinkSync(path.join(DATA_DIR, `${req.params.id}.json`));
  const uploadDir = path.join(UPLOADS_DIR, req.params.id);
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true });
  }
  res.status(204).send();
});
