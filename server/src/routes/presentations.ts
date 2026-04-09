import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data/presentations');
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export const presentationsRouter = Router();

function readPresentation(id: string) {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writePresentation(id: string, data: unknown) {
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(data, null, 2));
}

// List all presentations
presentationsRouter.get('/', (_req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const presentations = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
    return { id: data.id, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt };
  });
  presentations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(presentations);
});

// Get a presentation
presentationsRouter.get('/:id', (req, res) => {
  const data = readPresentation(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// Create a presentation
presentationsRouter.post('/', (req, res) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const presentation = {
    id,
    title: req.body.title || 'Sans titre',
    createdAt: now,
    updatedAt: now,
    slides: [
      {
        id: uuidv4(),
        background: '#ffffff',
        elements: [],
      },
    ],
  };
  fs.mkdirSync(path.join(UPLOADS_DIR, id), { recursive: true });
  writePresentation(id, presentation);
  res.status(201).json(presentation);
});

// Update a presentation
presentationsRouter.put('/:id', (req, res) => {
  const existing = readPresentation(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const updated = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
  writePresentation(req.params.id, updated);
  res.json(updated);
});

// Delete a presentation
presentationsRouter.delete('/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  const uploadDir = path.join(UPLOADS_DIR, req.params.id);
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true });
  }
  res.status(204).send();
});
