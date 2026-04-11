import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { presentationsRouter } from './routes/presentations.js';
import { uploadsRouter } from './routes/uploads.js';
import { authRouter } from './routes/auth.js';
import { setupWebSocket } from './websocket.js';
import { ensureDefaultUser } from './auth.js';
import { startCleanupJob } from './cleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// Ensure data directories exist
const DATA_DIR = path.join(ROOT, 'server/data/presentations');
const UPLOADS_DIR = path.join(ROOT, 'server/uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

await ensureDefaultUser();
startCleanupJob(DATA_DIR, UPLOADS_DIR);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/presentations', presentationsRouter);
app.use('/api/presentations', uploadsRouter);

// Serve frontend in production
const clientDist = path.join(ROOT, 'client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`VideoSlide server running on http://localhost:${PORT}`);
});
