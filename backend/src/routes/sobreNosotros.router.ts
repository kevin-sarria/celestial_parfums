import { Router } from 'express';
import * as repo from '../repositories/sobreNosotros.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { uploadMemoria } from '../config/upload';
import { h } from '../middleware/error.middleware';
import { badRequest } from '../utils/httpError';
import { guardarWebp } from '../utils/imagenWebp';
import { getPublicBaseUrl } from '../utils/publicUrl';

export const nosotrosRouter = Router();

/** Público: la config solo si está activa. */
nosotrosRouter.get('/', h(async (_req, res) => {
  const cfg = await repo.getConfig();
  res.json({ data: cfg.activo ? cfg : null });
}));

// ── Admin ────────────────────────────────────────────────────────────────────
nosotrosRouter.get('/config', requireAdmin, h(async (_req, res) => {
  res.json({ data: await repo.getConfig() });
}));

nosotrosRouter.patch('/config', requireAdmin, h(async (req, res) => {
  const { titulo, historia, activo } = req.body ?? {};
  res.json({ message: 'Guardado', data: await repo.saveConfig({ titulo, historia, activo }) });
}));

nosotrosRouter.post('/imagen', requireAdmin, uploadMemoria.single('imagen'), h(async (req, res) => {
  if (!req.file) throw badRequest('Adjunta una imagen');
  const url = await guardarWebp(req.file.buffer, getPublicBaseUrl(req));
  res.json({ message: 'Imagen guardada', data: await repo.saveConfig({ imagen: url }) });
}));
