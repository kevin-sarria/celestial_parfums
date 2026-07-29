import { Router } from 'express';
import * as repo from '../repositories/cotizacion.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { h } from '../middleware/error.middleware';
import { badRequest, notFound } from '../utils/httpError';
import { parsePagination, parseSearch } from '../utils/pagination';
import { cotizacionSchema } from '../schemas/cotizacion.schema';

/** Cotizaciones mayoristas: 100% solo-admin (llevan los costos internos). */
export const cotizacionRouter = Router();
cotizacionRouter.use(requireAdmin);

cotizacionRouter.get('/', h(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  res.json(await repo.listarCotizaciones(page, limit, parseSearch(req.query as any)));
}));

cotizacionRouter.get('/:id', h(async (req, res) => {
  const data = await repo.obtenerCotizacion(Number(req.params.id));
  if (!data) throw notFound('Cotización no encontrada');
  res.json({ data });
}));

cotizacionRouter.post('/', validate(cotizacionSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Cotización creada', data: await repo.crearCotizacion(req.body) });
}));

cotizacionRouter.patch('/:id', validate(cotizacionSchema), h(async (req, res) => {
  res.json({ message: 'Cotización actualizada', data: await repo.actualizarCotizacion(Number(req.params.id), req.body) });
}));

/** Marca enviada/borrador sin tocar las líneas (al compartirla por WhatsApp). */
cotizacionRouter.patch('/:id/estado', h(async (req, res) => {
  const estado = req.body?.estado;
  if (estado !== 'borrador' && estado !== 'enviada') throw badRequest('Estado inválido');
  res.json({ message: 'Estado actualizado', data: await repo.marcarEstado(Number(req.params.id), estado) });
}));

cotizacionRouter.delete('/:id', h(async (req, res) => {
  await repo.eliminarCotizacion(Number(req.params.id));
  res.json({ message: 'Cotización eliminada' });
}));
