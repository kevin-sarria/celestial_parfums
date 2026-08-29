import * as ventaService from '../services/venta.service';
import { mapaFiltrosVenta } from '../repositories/venta.repository';
import { parsePagination, parseSearch } from '../utils/pagination';
import { parseFiltros } from '../utils/filtros';
import { h } from '../middleware/error.middleware';

// Handlers envueltos con h(): los errores (incl. HttpError con status
// semántico, ej. conflictos de códigos de descuento) van al middleware central.

export const getVentas = h(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  // `con_totales=1`: la pantalla pinta lista y totales a la vez, así que se
  // mandan juntos y se ahorra un viaje al servidor.
  res.json(await ventaService.getAllVentas(
    page, limit, parseSearch(req.query), req.query.con_totales === '1',
    parseFiltros(req.query, mapaFiltrosVenta),
  ));
});

/**
 * `avisos` viaja aparte del `data` y no dentro de la venta: no es un dato suyo,
 * es lo que hay que contarle al dueño de ESTA operación ("vendiste un 1.1 sin
 * tenerlo armado"). Guardarlo en la venta lo volvería historia; aquí muere con
 * la respuesta, que es lo que es.
 */
export const addVenta = h(async (req, res) => {
  const { avisos, ...data } = await ventaService.createVenta(req.body);
  res.status(201).json({ message: 'Venta registrada', data, avisos });
});

export const editVenta = h(async (req, res) => {
  const { avisos, ...data } = await ventaService.updateVenta(req.params.id as string, req.body);
  res.json({ message: 'Venta actualizada', data, avisos });
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

/** Serie de los últimos 12 meses para el gráfico del dashboard. */
export const getPorMes = h(async (_req, res) => {
  res.json({ data: await ventaService.getVentasPorMes() });
});
