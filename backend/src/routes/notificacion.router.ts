import { Router } from 'express';
import * as repo from '../repositories/notificacion.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';

/**
 * Avisos del dashboard. 100% internos: dicen cuánto se debe, qué material
 * falta y qué perfumes no descuentan, así que van detrás de `requireAdmin`.
 */
export const notificacionRouter = Router();
notificacionRouter.use(requireAdmin);

notificacionRouter.get('/', h(async (_req, res) => {
  res.json({ data: await repo.calcularNotificaciones() });
}));
