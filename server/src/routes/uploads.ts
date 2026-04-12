import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate, checkWriteAccess } from '../auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DATA_DIR = path.resolve(__dirname, '../../data/presentations');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
