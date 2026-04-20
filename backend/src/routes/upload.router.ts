import { Router, Request, Response } from 'express';
import { upload } from '../config/upload';

export const uploadRouter = Router();

uploadRouter.post('/', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se recibió archivo' });
    return;
  }
  res.json({ url: `http://localhost:4000/uploads/${req.file.filename}` });
});
