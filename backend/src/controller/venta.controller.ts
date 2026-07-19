import * as ventaService from '../services/venta.service';
import { parsePagination, parseSearch } from '../utils/pagination';
import { h } from '../middleware/error.middleware';

// Handlers envueltos con h(): los errores (incl. HttpError con status
// semántico, ej. conflictos de códigos de descuento) van al middleware central.

export const getVentas = h(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  res.json(await ventaService.getAllVentas(page, limit, parseSearch(req.query as any)));
});

export const addVenta = h(async (req, res) => {
  const data = await ventaService.createVenta(req.body);
  res.status(201).json({ message: 'Venta registrada', data });
});

export const editVenta = h(async (req, res) => {
  const data = await ventaService.updateVenta(req.params.id as string, req.body);
  res.json({ message: 'Venta actualizada', data });
});

export const removeVenta = h(async (req, res) => {
  await ventaService.deleteVenta(req.params.id as string);
  res.json({ message: 'Venta eliminada' });
});

export const getTotales = h(async (_req, res) => {
  res.json({ data: await ventaService.getVentaTotales() });
});

export const relinkPerfumes = h(async (_req, res) => {
  const data = await ventaService.relinkVentasPerfume();
  res.json({ message: `${data.enlazadas} de ${data.revisadas} ventas enlazadas a un perfume`, data });
});
