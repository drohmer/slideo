import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.resolve(__dirname, '../../data/users.json');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string };
    }
  }
}

export function loadUsers(): User[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function ensureDefaultUser() {
  const users = loadUsers();
  if (users.length > 0) return;
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;
  if (!username || !password) {
    console.warn('[auth] No users found and AUTH_USERNAME/AUTH_PASSWORD not set — authentication will not work');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  saveUsers([{ id: uuidv4(), username, passwordHash }]);
  console.log(`[auth] Created default user: ${username}`);
}

export function signToken(userId: string, username: string): string {
  return jwt.sign({ sub: userId, username }, JWT_SECRET as string, { expiresIn: '7d' });
}

export function verifyToken(token: string): { sub: string; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as { sub: string; username: string };
  } catch {
    return null;
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const payload = verifyToken(header.slice(7));
    if (payload) {
      req.user = { id: payload.sub, username: payload.username };
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, () => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  });
}

export interface WriteProtected {
  ownerId?: string;
  anonymous?: true;
  editToken?: string;
  shareToken?: string;
}

export function checkWriteAccess(existing: WriteProtected, req: Request, res: Response): boolean {
  const shareToken = req.headers['x-share-token'];
  if (typeof shareToken === 'string' && shareToken.length > 0 && shareToken === existing.shareToken) return true;

  if (existing.ownerId) {
    if (!req.user || req.user.id !== existing.ownerId) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  }
  if (existing.anonymous) {
    const token = req.headers['x-edit-token'];
    if (typeof token !== 'string' || token.length === 0 || token !== existing.editToken) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  }
  // Legacy presentation without auth fields — allow
  return true;
}
