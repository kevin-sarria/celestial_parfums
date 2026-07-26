import { Router } from 'express';
import * as repo from '../repositories/avisoStock.repository';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { badRequest } from '../utils/httpError';

export const avisoRouter = Router();

// ── Cliente ──────────────────────────────────────────────────────────────────
/** Perfumes que el cliente está esperando (para pintar el botón). */
avisoRouter.get('/mios', requireAuth, h(async (req, res) => {
  res.json({ data: await repo.misAvisos(req.jwtUser!.id) });
}));

avisoRouter.post('/:perfumeId', requireAuth, h(async (req, res) => {
  const perfumeId = Number(req.params.perfumeId);
  if (!perfumeId) throw badRequest('Perfume inválido');
  res.json({ data: await repo.pedirAviso(req.jwtUser!.id, perfumeId) });
}));

avisoRouter.delete('/:perfumeId', requireAuth, h(async (req, res) => {
  res.json({ data: await repo.cancelarAviso(req.jwtUser!.id, Number(req.params.perfumeId)) });
}));

// ── Admin ────────────────────────────────────────────────────────────────────
/** Demanda pendiente: qué perfumes esperan reponer y quiénes (con contacto). */
avisoRouter.get('/admin', requireAdmin, h(async (_req, res) => {
  res.json({ data: await repo.demandaStock() });
}));

/** El admin marca como avisados a los que esperaban un perfume. */
avisoRouter.post('/admin/:perfumeId/notificados', requireAdmin, h(async (req, res) => {
  await repo.marcarAvisados(Number(req.params.perfumeId));
  res.json({ message: 'Clientes marcados como avisados' });
}));
