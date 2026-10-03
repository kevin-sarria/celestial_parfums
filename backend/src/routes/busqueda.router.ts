import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { buscarEnTodo } from '../repositories/busqueda.repository';

/** El buscador general del panel (ver `busqueda.repository.ts`). Solo admin. */
export const busquedaRouter = Router();
busquedaRouter.use(requireAdmin);

busquedaRouter.get('/', h(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '';
  res.json({ data: await buscarEnTodo(q) });
}));
