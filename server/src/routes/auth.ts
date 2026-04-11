import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers, signToken, requireAuth } from '../auth.js';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signToken(user.id, user.username);
  res.json({ token, id: user.id, username: user.username });
});

authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  if (typeof username !== 'string' || username.length < 2 || username.length > 32) {
    res.status(400).json({ error: 'Username must be 2–32 characters' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  const users = loadUsers();
  if (users.find(u => u.username === username)) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { id: uuidv4(), username, passwordHash };
  saveUsers([...users, newUser]);
  const token = signToken(newUser.id, newUser.username);
  res.status(201).json({ token, id: newUser.id, username: newUser.username });
});

authRouter.post('/logout', (_req, res) => {
  res.status(204).send();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user!.id, username: req.user!.username });
});
