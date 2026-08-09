import { Router } from 'express';
import * as repo from '../repositories/costeo.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { h } from '../middleware/error.middleware';
import {
  insumoSchema, formulaSchema, escalaSchema, cotizacionConfigSchema, accesoriosFormulaSchema,
} from '../schemas/cotizacion.schema';

/**
 * Datos de costeo del módulo mayorista (insumos, fórmulas, escalas y textos).
 * TODO es solo-admin: aquí viven los costos internos del negocio.
 */
export const costeoRouter = Router();
costeoRouter.use(requireAdmin);

// ── Insumos ─────────────────────────────────────────────────────────────────
/** `?todos=1` incluye los apagados; sin él solo vienen los activos, que es lo
 *  que deben ver los buscadores de compras y producción. */
costeoRouter.get('/insumos', h(async (req, res) => {
  res.json({ data: await repo.listarInsumos(req.query.todos === '1') });
}));

/** Costo por ml de cada gama de esencia: con qué se cotiza cuando el cliente
 *  pide "50 de 30 ml" sin decir qué fragancias. */
costeoRouter.get('/gamas', h(async (_req, res) => {
  res.json({ data: await repo.promediosPorGama() });
}));

costeoRouter.post('/insumos', validate(insumoSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Insumo creado', data: await repo.crearInsumo(req.body) });
}));

costeoRouter.patch('/insumos/:id', validate(insumoSchema), h(async (req, res) => {
  res.json({ message: 'Insumo actualizado', data: await repo.actualizarInsumo(Number(req.params.id), req.body) });
}));

costeoRouter.delete('/insumos/:id', h(async (req, res) => {
  await repo.eliminarInsumo(Number(req.params.id));
  res.json({ message: 'Insumo eliminado' });
}));

// ── Fórmulas por volumen (traen sus escalas incluidas) ──────────────────────
costeoRouter.get('/formulas', h(async (_req, res) => {
  res.json({ data: await repo.listarFormulas() });
}));

costeoRouter.post('/formulas', validate(formulaSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Tamaño creado', data: await repo.crearFormula(req.body) });
}));

costeoRouter.patch('/formulas/:id', validate(formulaSchema), h(async (req, res) => {
  res.json({ message: 'Tamaño actualizado', data: await repo.actualizarFormula(Number(req.params.id), req.body) });
}));

costeoRouter.delete('/formulas/:id', h(async (req, res) => {
  await repo.eliminarFormula(Number(req.params.id));
  res.json({ message: 'Tamaño eliminado' });
}));

/** Accesorios que este tamaño incluye por defecto (bolsa, perfumero…). */
// PATCH (no PUT): el CORS de la app solo permite GET/POST/PATCH/DELETE, así que
// un PUT desde el navegador muere en el preflight.
costeoRouter.patch('/formulas/:id/accesorios', validate(accesoriosFormulaSchema), h(async (req, res) => {
  const data = await repo.setAccesoriosFormula(Number(req.params.id), req.body.insumo_ids);
  res.json({ message: 'Accesorios actualizados', data });
}));

// ── Escalas de precio mayorista ─────────────────────────────────────────────
costeoRouter.post('/escalas', validate(escalaSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Escala creada', data: await repo.crearEscala(req.body) });
}));

costeoRouter.patch('/escalas/:id', validate(escalaSchema), h(async (req, res) => {
  res.json({ message: 'Escala actualizada', data: await repo.actualizarEscala(Number(req.params.id), req.body) });
}));

costeoRouter.delete('/escalas/:id', h(async (req, res) => {
  await repo.eliminarEscala(Number(req.params.id));
  res.json({ message: 'Escala eliminada' });
}));

// ── Config de textos y valores por defecto ──────────────────────────────────
costeoRouter.get('/config', h(async (_req, res) => {
  res.json({ data: await repo.getConfig() });
}));

costeoRouter.patch('/config', validate(cotizacionConfigSchema), h(async (req, res) => {
  res.json({ message: 'Configuración guardada', data: await repo.saveConfig(req.body) });
}));
