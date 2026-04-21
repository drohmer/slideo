import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate, checkWriteAccess } from '../auth.js';
import { UUID_RE } from '../validation.js';
import { safeFetchToFile, SafeFetchError } from '../ssrf.js';

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

  // Pre-derive a safe filename from the URL pathname
  let parsed: URL;
  try { parsed = new URL(url); } catch { res.status(400).json({ error: 'Invalid URL' }); return; }
  let filename = path.basename(parsed.pathname).replace(/[^a-zA-Z0-9._-]/g, '_') || 'video';
  if (!filename.includes('.')) filename += '.mp4';
  filename = `${Date.now()}-${filename}`;

  const uploadDir = path.join(UPLOADS_DIR, req.params.id);
  fs.mkdirSync(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  const writer = fs.createWriteStream(filePath);

  try {
    await safeFetchToFile(url, filePath, {
      writeStream: writer,
      maxBytes: 500 * 1024 * 1024,
      timeoutMs: 30_000,
      allowedContentTypes: ['video/', 'application/octet-stream'],
    });
  } catch (e) {
    writer.destroy();
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    if (e instanceof SafeFetchError) {
      res.status(e.status).json({ error: e.message, code: e.code }); return;
    }
    res.status(400).json({ error: 'Download failed' }); return;
  }

  res.json({ path: `/uploads/${req.params.id}/${filename}`, filename });
});
