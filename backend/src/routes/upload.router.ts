import { Router, Request, Response } from 'express';
import { upload } from '../config/upload';
import { requireAdmin } from '../middleware/auth.middleware';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export const uploadRouter = Router();

uploadRouter.post('/', requireAdmin, upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se recibió archivo' });
    return;
  }
  res.json({ url: `${BACKEND_URL}/uploads/${req.file.filename}` });
});
