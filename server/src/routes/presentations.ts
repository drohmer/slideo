import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../auth.js';
import type { Request, Response, NextFunction } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data/presentations');
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export const presentationsRouter = Router();

presentationsRouter.use(authenticate);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateId(req: Request, res: Response, next: NextFunction) {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  next();
}

presentationsRouter.use('/:id', validateId);

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

function stripEditToken(obj: StoredPresentation): Omit<StoredPresentation, 'editToken'> {
  const { editToken: _token, ...rest } = obj;
  return rest;
}

function checkWriteAccess(existing: StoredPresentation, req: Request, res: Response): boolean {
  const shareToken = req.headers['x-share-token'];
  if (shareToken && shareToken === existing.shareToken) return true;

  if (existing.ownerId) {
    if (!req.user || req.user.id !== existing.ownerId) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  }
  if (existing.anonymous) {
    const token = req.headers['x-edit-token'];
    if (!token || token !== existing.editToken) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  }
  // Legacy presentation without auth fields — allow
  return true;
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
presentationsRouter.get('/:id', (req, res) => {
  const data = readPresentation(req.params.id);
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(stripEditToken(data));
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

// Get share token (requires write access)
presentationsRouter.get('/:id/share-token', (req, res) => {
  const existing = readPresentation(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkWriteAccess(existing, req, res)) return;
  res.json({ shareToken: existing.shareToken });
});

// Update a presentation
presentationsRouter.put('/:id', (req, res) => {
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
  res.json(stripEditToken(updated));
});

// Delete a presentation
presentationsRouter.delete('/:id', (req, res) => {
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
