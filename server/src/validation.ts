import type { Request, Response, NextFunction } from 'express';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateId(req: Request, res: Response, next: NextFunction) {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  next();
}
