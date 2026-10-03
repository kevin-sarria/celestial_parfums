import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { parsePagination, parseSearch } from '../utils/pagination';
import { listarCambios } from '../repositories/registroCambios.repository';

/** El historial de cambios del panel. Solo el dueño: dice quién hizo qué. */
export const historialRouter = Router();
historialRouter.use(requireAdmin);

historialRouter.get('/', h(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  res.json(await listarCambios(page, limit, parseSearch(req.query)));
}));
