import { Router } from 'express';
import * as repo from '../repositories/inventario.repository';
import * as reposicion from '../repositories/reposicion.repository';
import { requireAdmin } from '../middleware/auth.middleware';
// Mover el stock de una esencia cambia qué perfumes se pueden armar hoy, y de
// eso depende cuáles salen agotados en la tienda. Sin limpiar el caché, el
// dueño registra la llegada de una esencia y el perfume sigue diciendo
// "agotado" varios minutos — y concluye, con razón, que no funcionó.
import { bustCatalogoCache } from '../services/perfume.service';
import { validate } from '../middleware/validate.middleware';
import { h } from '../middleware/error.middleware';
import {
  ajusteSchema, produccionSchema, salidaSchema, minimoSchema, minimosGamasSchema,
} from '../schemas/inventario.schema';

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

/**
 * Los puntos de pedido de TODAS las gamas, en una sola petición, y **devuelve
 * la lista ya recalculada**.
 *
 * Antes era un `PATCH` por gama y luego otra llamada para volver a pedir la
 * lista: cinco viajes para guardar cuatro casillas de un mismo formulario. Y
 * peor, si una fallaba la pantalla quedaba a medio guardar.
 *
 * Devolver la reposición aquí no es un capricho de rendimiento: cambiar un
 * mínimo **cambia la pantalla entera** (qué está bajo mínimo, cuánto pedir,
 * cuánto costará), y eso solo se puede calcular en el servidor, que es quien
 * tiene el consumo de los últimos 90 días.
 *
 * Es PATCH y no PUT a propósito: **el CORS de esta app no permite PUT** y
 * moriría en el preflight del navegador (con `curl` sí funcionaría, así que el
 * fallo no se ve probando por consola).
 */
inventarioRouter.patch('/minimos-gama', validate(minimosGamasSchema), h(async (req, res) => {
  const data = await reposicion.fijarMinimosGamas(req.body.minimos);
  res.json({ message: 'Listo: te avisaremos con esos mínimos', data });
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
  const data = await repo.ajustarStock(req.body);
  bustCatalogoCache();
  res.status(201).json({ message: 'Inventario ajustado', data });
}));

/** Salida sin venta: muestra del mostrario, mini de regalo o merma. */
inventarioRouter.post('/salidas', validate(salidaSchema), h(async (req, res) => {
  const data = await repo.registrarSalida(req.body);
  bustCatalogoCache();
  res.status(201).json({ message: 'Salida registrada', data });
}));

inventarioRouter.get('/producciones', h(async (_req, res) => {
  res.json({ data: await repo.listarProducciones() });
}));

/** Registra un lote armado y descuenta sus insumos. */
inventarioRouter.post('/producciones', validate(produccionSchema), h(async (req, res) => {
  const data = await repo.registrarProduccion(req.body);
  bustCatalogoCache();
  res.status(201).json({ message: 'Producción registrada', data });
}));

inventarioRouter.delete('/producciones/:id', h(async (req, res) => {
  await repo.eliminarProduccion(Number(req.params.id));
  bustCatalogoCache();
  res.json({ message: 'Producción eliminada; los insumos volvieron al inventario' });
}));
