import { Router } from 'express';
import * as repo from '../repositories/reporte.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { reporteVentasRango } from '../repositories/reporteVentasRango';
import { resumenInicio } from '../repositories/inicio.repository';
import { ponerMeta } from '../repositories/metaMensual';
import { listaRecompra } from '../repositories/recompra';
import { badRequest } from '../utils/httpError';
import { hoyEnColombia } from '../utils/fechas';

/** Reportes del negocio: 100% internos (llevan costos, deudas y ranking de clientes). */
export const reporteRouter = Router();
reporteRouter.use(requireAdmin);

/** Cuántos meses pide el gráfico, acotado para que nadie pida 10 años por la URL. */
const meses = (v: unknown) => Math.min(24, Math.max(3, Number(v) || 12));

/** 'AAAA-MM-DD' → fecha de calendario (medianoche UTC, como lee Prisma un `@db.Date`). */
const fechaDeUrl = (v: unknown, nombre: string) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest(`Falta la fecha "${nombre}" (AAAA-MM-DD)`);
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw badRequest(`La fecha "${nombre}" no es válida`);
  return d;
};

/**
 * Ventas entre dos fechas, ambas incluidas. Sin fechas: el mes en curso.
 * Se acota a 5 años para que una URL no pida el historial de un siglo.
 */
reporteRouter.get('/ventas', h(async (req, res) => {
  const hoy = hoyEnColombia();
  const desde = req.query.desde ? fechaDeUrl(req.query.desde, 'desde')
    : new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const hasta = req.query.hasta ? fechaDeUrl(req.query.hasta, 'hasta') : hoy;
  if (desde > hasta) throw badRequest('La fecha "desde" va después de "hasta"');
  if (hasta.getTime() - desde.getTime() > 5 * 366 * 86_400_000) throw badRequest('El rango máximo es de 5 años');
  res.json({ data: await reporteVentasRango(desde, hasta) });
}));

/** La pantalla de Inicio: el mes contra el anterior, la cartera y lo que hay que atender. */
reporteRouter.get('/inicio', h(async (_req, res) => {
  res.json({ data: await resumenInicio() });
}));

/** La meta de ventas de un mes: { mes: 'AAAA-MM', monto }. Con 0 se quita. */
reporteRouter.patch('/meta', h(async (req, res) => {
  res.json({ data: await ponerMeta(req.body?.mes, req.body?.monto) });
}));

/** A qué cliente ya se le debería estar acabando el perfume, por su propio ritmo de compra. */
reporteRouter.get('/recompra', h(async (_req, res) => {
  res.json({ data: await listaRecompra() });
}));

reporteRouter.get('/compras', h(async (req, res) => {
  res.json({ data: await repo.reporteCompras(meses(req.query.meses)) });
}));

reporteRouter.get('/clientes', h(async (req, res) => {
  res.json({ data: await repo.reporteClientes(meses(req.query.meses)) });
}));
