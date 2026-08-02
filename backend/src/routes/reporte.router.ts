import { Router } from 'express';
import * as repo from '../repositories/reporte.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';

/** Reportes del negocio: 100% internos (llevan costos, deudas y ranking de clientes). */
export const reporteRouter = Router();
reporteRouter.use(requireAdmin);

/** Cuántos meses pide el gráfico, acotado para que nadie pida 10 años por la URL. */
const meses = (v: unknown) => Math.min(24, Math.max(3, Number(v) || 12));

reporteRouter.get('/ventas', h(async (req, res) => {
  res.json({ data: await repo.reporteVentas(meses(req.query.meses)) });
}));

reporteRouter.get('/compras', h(async (req, res) => {
  res.json({ data: await repo.reporteCompras(meses(req.query.meses)) });
}));

reporteRouter.get('/clientes', h(async (req, res) => {
  res.json({ data: await repo.reporteClientes(meses(req.query.meses)) });
}));
