import { Router, Request, Response } from 'express';
import { upload } from '../config/upload';
import { requireAdmin } from '../middleware/auth.middleware';
import { getPublicBaseUrl } from '../utils/publicUrl';

export const uploadRouter = Router();

uploadRouter.post('/', requireAdmin, upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se recibió archivo' });
    return;
  }
  res.json({ url: `${getPublicBaseUrl(req)}/api/uploads/${req.file.filename}` });
});
