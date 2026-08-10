import { Router } from 'express';
import * as repo from '../repositories/inventario.repository';
import * as reposicion from '../repositories/reposicion.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { h } from '../middleware/error.middleware';
import { ajusteSchema, produccionSchema, salidaSchema, minimoSchema } from '../schemas/inventario.schema';

/** Inventario de insumos: 100% interno (lleva costos reales del negocio). */
export const inventarioRouter = Router();
inventarioRouter.use(requireAdmin);

/** Qué hay en bodega y cuánto vale. */
inventarioRouter.get('/', h(async (_req, res) => {
  const [resumen, salidas] = await Promise.all([repo.resumenInventario(), repo.salidasDelMes()]);
  res.json({ data: { ...resumen, salidas_mes: salidas } });
}));

/**
 * Progreso del arranque, para la lista de "Primeros pasos".
 * Un solo endpoint porque son cuatro conteos: pedirlos por separado
 * serían cuatro viajes para pintar una sola caja.
 */
/** Pedido sugerido: qué reponer y cuánto. Solo lee, no mueve nada. */
inventarioRouter.get('/reposicion', h(async (_req, res) => {
  res.json({ data: await reposicion.calcularReposicion() });
}));

/**
 * Punto de pedido de UN material, sin tocar existencias. Va aparte del modal de
 * Ajustar (que es un conteo físico y deja movimiento): corregir un mínimo no es
 * contar, y no debe ensuciar el libro con un movimiento que no ocurrió.
 */
inventarioRouter.patch('/minimo/:id', validate(minimoSchema), h(async (req, res) => {
  const dato = await reposicion.fijarMinimoInsumo(Number(req.params.id), req.body.minimo ?? null);
  res.json({
    message: req.body.minimo == null
      ? `"${dato.nombre}" vuelve a usar el mínimo de su gama`
      : `Mínimo de "${dato.nombre}" actualizado`,
    data: dato,
  });
}));

/** Punto de pedido por defecto de todas las esencias de una gama. */
inventarioRouter.patch('/minimo-gama/:id', validate(minimoSchema), h(async (req, res) => {
  const dato = await reposicion.fijarMinimoGama(Number(req.params.id), req.body.minimo ?? 0);
  res.json({ message: `Mínimo de la gama "${dato.nombre}" actualizado`, data: dato });
}));

inventarioRouter.get('/primeros-pasos', h(async (_req, res) => {
  res.json({ data: await repo.primerosPasos() });
}));

/** Movimientos de un insumo (entradas y salidas con su costo). */
inventarioRouter.get('/movimientos/:insumoId', h(async (req, res) => {
  res.json({ data: await repo.movimientosDeInsumo(Number(req.params.insumoId)) });
}));

/** Conteo físico: "tengo X". El sistema calcula la diferencia. */
inventarioRouter.post('/ajustes', validate(ajusteSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Inventario ajustado', data: await repo.ajustarStock(req.body) });
}));

/** Salida sin venta: muestra del mostrario, mini de regalo o merma. */
inventarioRouter.post('/salidas', validate(salidaSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Salida registrada', data: await repo.registrarSalida(req.body) });
}));

inventarioRouter.get('/producciones', h(async (_req, res) => {
  res.json({ data: await repo.listarProducciones() });
}));

/** Registra un lote armado y descuenta sus insumos. */
inventarioRouter.post('/producciones', validate(produccionSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Producción registrada', data: await repo.registrarProduccion(req.body) });
}));

inventarioRouter.delete('/producciones/:id', h(async (req, res) => {
  await repo.eliminarProduccion(Number(req.params.id));
  res.json({ message: 'Producción eliminada; los insumos volvieron al inventario' });
}));
