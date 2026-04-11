import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DATA_DIR = path.resolve(__dirname, '../../data/presentations');

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(UPLOADS_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    // Keep original name but ensure uniqueness with timestamp prefix
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
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

export const uploadsRouter = Router();

uploadsRouter.post('/:id/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  // Check write access
  const filePath = path.join(DATA_DIR, `${req.params.id}.json`);
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (existing.ownerId) {
      if (!req.user || req.user.id !== existing.ownerId) {
        res.status(403).json({ error: 'Forbidden' }); return;
      }
    } else if (existing.anonymous) {
      const token = req.headers['x-edit-token'];
      if (!token || token !== existing.editToken) {
        res.status(403).json({ error: 'Forbidden' }); return;
      }
    }
  }

  const relativePath = `/uploads/${req.params.id}/${req.file.filename}`;
  res.json({ path: relativePath, filename: req.file.filename });
});
