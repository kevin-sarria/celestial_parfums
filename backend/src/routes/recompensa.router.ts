import { Router } from 'express';
import * as repo from '../repositories/recompensa.repository';
import * as entregaRepo from '../repositories/recompensaEntrega.repository';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadMemoria } from '../config/upload';
import { h } from '../middleware/error.middleware';
import { badRequest } from '../utils/httpError';
import { parsePagination, parseSearch } from '../utils/pagination';
import { guardarVariasWebp } from '../utils/imagenWebp';
import { getPublicBaseUrl } from '../utils/publicUrl';
import { recompensaConfigSchema, recompensaOverrideSchema } from '../schemas/recompensa.schema';

export const recompensaRouter = Router();

/** Fotos de una entrega desde un multipart (máx 3, convertidas a WebP). */
const fotosDeEntrega = async (req: any) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const conservar: string[] = req.body?.conservar
    ? (Array.isArray(req.body.conservar) ? req.body.conservar : [req.body.conservar]) : [];
  const nuevas = files.length ? await guardarVariasWebp(files.map((f) => f.buffer), getPublicBaseUrl(req)) : [];
  return [...conservar, ...nuevas].slice(0, 3);
};

// ── Público: galería de ganadores ────────────────────────────────────────────
recompensaRouter.get('/ganadores', h(async (_req, res) => {
  res.json({ data: await entregaRepo.galeriaGanadores() });
}));

// ── Cliente logueado ─────────────────────────────────────────────────────────
recompensaRouter.get('/mi-tarjeta', requireAuth, h(async (req, res) => {
  res.json({ data: await repo.calcularTarjeta(req.jwtUser!.id) });
}));

recompensaRouter.get('/mis-entregas', requireAuth, h(async (req, res) => {
  res.json({ data: await entregaRepo.misEntregas(req.jwtUser!.id) });
}));

// El cliente sube fotos de SU premio (quedan pendientes de aprobación)
recompensaRouter.post('/entregas/:id/fotos', requireAuth, uploadMemoria.array('imagenes', 3), h(async (req, res) => {
  const imagenes = await fotosDeEntrega(req);
  if (!imagenes.length) throw badRequest('Adjunta al menos una foto');
  const data = await entregaRepo.subirFotosEntrega(Number(req.params.id), imagenes, req.jwtUser!.id);
  res.json({ message: 'Fotos enviadas; las revisaremos antes de publicarlas', data });
}));

// ── Admin ────────────────────────────────────────────────────────────────────
recompensaRouter.get('/config', requireAdmin, h(async (_req, res) => {
  res.json({ data: await repo.getConfig() });
}));

recompensaRouter.patch('/config', requireAdmin, validate(recompensaConfigSchema), h(async (req, res) => {
  res.json({ message: 'Configuración guardada', data: await repo.saveConfig(req.body) });
}));

recompensaRouter.get('/clientes', requireAdmin, h(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  res.json(await repo.getClientes(page, limit, parseSearch(req.query as any)));
}));

recompensaRouter.post('/clientes/:id/entregar', requireAdmin, h(async (req, res) => {
  res.json({ message: 'Premio entregado', data: await repo.entregarPremio(Number(req.params.id)) });
}));

recompensaRouter.patch('/clientes/:id/override', requireAdmin, validate(recompensaOverrideSchema), h(async (req, res) => {
  res.json({ message: 'Regla del cliente guardada', data: await repo.setOverride(Number(req.params.id), req.body) });
}));

// ── Admin: galería de ganadores (fotos + moderación) ─────────────────────────
recompensaRouter.get('/admin/entregas', requireAdmin, h(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  res.json(await entregaRepo.listarEntregasAdmin(page, limit, req.query.estado as string | undefined));
}));

recompensaRouter.post('/admin/entregas/:id/fotos', requireAdmin, uploadMemoria.array('imagenes', 3), h(async (req, res) => {
  const imagenes = await fotosDeEntrega(req);
  const data = await entregaRepo.subirFotosEntrega(Number(req.params.id), imagenes);
  res.json({ message: 'Fotos guardadas', data });
}));

recompensaRouter.patch('/admin/entregas/:id', requireAdmin, h(async (req, res) => {
  res.json({ message: 'Entrega actualizada', data: await entregaRepo.moderarEntrega(Number(req.params.id), req.body.estado) });
}));

recompensaRouter.delete('/admin/entregas/:id', requireAdmin, h(async (req, res) => {
  await entregaRepo.eliminarEntrega(Number(req.params.id));
  res.json({ message: 'Entrega eliminada' });
}));
