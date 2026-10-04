import { Router } from 'express';
import * as repo from '../repositories/notificacion.repository';
import { requirePersonal } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';

/**
 * Avisos del dashboard. 100% internos: dicen cuánto se debe, qué material
 * falta y qué perfumes no descuentan, así que van detrás de `requireAdmin`.
 */
export const notificacionRouter = Router();
notificacionRouter.use(requirePersonal);

/**
 * La campana. El dueño ve todo lo pendiente; el personal (2026-10-04) solo lo
 * suyo, que hoy es nada: lo demás habla de costos, inventario y deudas.
 */
notificacionRouter.get('/', h(async (req, res) => {
  res.json({ data: req.jwtUser!.rol_id === 1 ? await repo.calcularNotificaciones() : [] });
}));
