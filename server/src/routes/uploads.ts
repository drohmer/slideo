import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate, checkWriteAccess } from '../auth.js';
import { UUID_RE } from '../validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DATA_DIR = path.resolve(__dirname, '../../data/presentations');

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    if (!UUID_RE.test(req.params.id)) {
      cb(new Error('Invalid id'), '');
      return;
    }
    const dir = path.join(UPLOADS_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter(_req, file, cb) {
    const allowed = /^(video|image)\//;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video and image files are allowed'));
    }
  },
});

function cleanupFile(file: Express.Multer.File | undefined) {
  if (file) {
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
  }
}

const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i;

export const uploadsRouter = Router();

uploadsRouter.post('/:id/upload', authenticate, upload.single('file'), (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    cleanupFile(req.file);
    res.status(400).json({ error: 'Invalid id' }); return;
  }
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  // Check write access
  const presPath = path.join(DATA_DIR, `${req.params.id}.json`);
  if (fs.existsSync(presPath)) {
    const existing = JSON.parse(fs.readFileSync(presPath, 'utf-8'));
    if (!checkWriteAccess(existing, req, res)) {
      cleanupFile(req.file);
      return;
    }
  }

  const relativePath = `/uploads/${req.params.id}/${req.file.filename}`;
  res.json({ path: relativePath, filename: req.file.filename });
});

uploadsRouter.post('/:id/upload-url', authenticate, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const presPath = path.join(DATA_DIR, `${req.params.id}.json`);
  if (fs.existsSync(presPath)) {
    const existing = JSON.parse(fs.readFileSync(presPath, 'utf-8'));
    if (!checkWriteAccess(existing, req, res)) return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== 'string') { res.status(400).json({ error: 'url required' }); return; }

  let parsed: URL;
  try { parsed = new URL(url); } catch { res.status(400).json({ error: 'Invalid URL' }); return; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'Only http/https allowed' }); return;
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    res.status(400).json({ error: 'Private addresses not allowed' }); return;
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'manual' });
  } catch { res.status(400).json({ error: 'Failed to reach URL' }); return; }

  if (response.status >= 300 && response.status < 400) {
    res.status(400).json({ error: 'URL redirects are not allowed (security)' }); return;
  }
  if (!response.ok || !response.body) {
    res.status(400).json({ error: `Remote returned ${response.status}` }); return;
  }

  const ct = response.headers.get('content-type') ?? '';
  if (!ct.startsWith('video/') && !ct.startsWith('application/octet-stream')) {
    res.status(400).json({ error: 'URL does not point to a video' }); return;
  }

  // Derive a safe filename from the URL path
  let filename = path.basename(parsed.pathname).replace(/[^a-zA-Z0-9._-]/g, '_') || 'video';
  if (!filename.includes('.')) filename += '.mp4';
  filename = `${Date.now()}-${filename}`;

  const uploadDir = path.join(UPLOADS_DIR, req.params.id);
  fs.mkdirSync(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  const writer = fs.createWriteStream(filePath);

  const MAX = 500 * 1024 * 1024;
  let written = 0;
  try {
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.length;
      if (written > MAX) { reader.cancel(); throw new Error('too large'); }
      await new Promise<void>((ok, ko) => writer.write(value, e => e ? ko(e) : ok()));
    }
    await new Promise<void>((ok, ko) => { writer.end(); writer.on('finish', ok); writer.on('error', ko); });
  } catch {
    writer.destroy();
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    res.status(400).json({ error: 'Download failed or file too large' }); return;
  }

  res.json({ path: `/uploads/${req.params.id}/${filename}`, filename });
});
