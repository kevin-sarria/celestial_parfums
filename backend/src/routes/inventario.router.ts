import { Router } from 'express';
import * as repo from '../repositories/inventario.repository';
import * as producciones from '../repositories/inventario.producciones';
import { crearFicha11YEnlazar, lotesPorEnlazar, mandarFrascosAlaFicha } from '../repositories/producciones.enlazar';
import * as reposicion from '../repositories/reposicion.repository';
import { alertasDisparadas, borrarAlerta, guardarAlerta, listarAlertas } from '../repositories/alertas.repository';
import { cargaInicialArmados, listarTerminado } from '../repositories/inventario.terminado';
import { requireAdmin } from '../middleware/auth.middleware';
// Mover el stock de una esencia cambia qué perfumes se pueden armar hoy, y de
// eso depende cuáles salen agotados en la tienda. Sin limpiar el caché, el
// dueño registra la llegada de una esencia y el perfume sigue diciendo
// "agotado" varios minutos — y concluye, con razón, que no funcionó.
import { bustCatalogoCache } from '../services/perfume.service';
import { validate } from '../middleware/validate.middleware';
import { h } from '../middleware/error.middleware';
import {
  ajusteSchema, produccionSchema, produccionEdicionSchema, cargaInicialArmadosSchema,
  fichaDeLoteSchema, enlazarLoteSchema, salidaSchema, minimoSchema, minimosGamasSchema,
  alertaSchema, enPruebaSchema,
} from '../schemas/inventario.schema';

/** Inventario de insumos: 100% interno (lleva costos reales del negocio). */
export const inventarioRouter = Router();
inventarioRouter.use(requireAdmin);

/**
 * Qué hay en bodega y cuánto vale.
 *
 * Van los materiales **y los frascos ya armados**: al producir, la plata sale
 * de los materiales y se queda en los frascos. Sin la segunda cifra, armar un
 * lote parece hacer desaparecer inventario.
 */
inventarioRouter.get('/', h(async (_req, res) => {
  const [resumen, salidas, terminado] = await Promise.all([
    repo.resumenInventario(), repo.salidasDelMes(), listarTerminado(),
  ]);
  res.json({ data: { ...resumen, salidas_mes: salidas, terminado } });
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

/**
 * EN PRUEBA: material que se trajo para ver si sale y que todavía no se repone.
 *
 * Va aparte del PATCH del material (que es el alta/edición completa) por lo
 * mismo que el mínimo: es un interruptor que se toca desde la lista, y obligar a
 * abrir el formulario entero para moverlo es justo la fricción que hace que no
 * se use.
 */
inventarioRouter.patch('/en-prueba/:id', validate(enPruebaSchema), h(async (req, res) => {
  const dato = await reposicion.marcarEnPrueba(Number(req.params.id), req.body.en_prueba);
  res.json({
    message: req.body.en_prueba
      ? `"${dato.nombre}" queda en prueba: no aparecerá en el pedido sugerido`
      : `"${dato.nombre}" vuelve al pedido sugerido`,
    data: dato,
  });
}));

// ── Alertas de inventario (una regla por familia) ───────────────────────────
inventarioRouter.get('/alertas', h(async (_req, res) => {
  res.json({ data: await listarAlertas() });
}));

/** Las que están saltando AHORA, para el aviso del dashboard. Solo lee. */
inventarioRouter.get('/alertas/activas', h(async (_req, res) => {
  res.json({ data: await alertasDisparadas() });
}));

/** Crea o corrige la regla de una familia (upsert por `ambito`). */
inventarioRouter.post('/alertas', validate(alertaSchema), h(async (req, res) => {
  res.json({ message: 'Alerta guardada', data: await guardarAlerta(req.body) });
}));

inventarioRouter.delete('/alertas/:id', h(async (req, res) => {
  await borrarAlerta(Number(req.params.id));
  res.json({ message: 'Alerta eliminada' });
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
  res.json({ data: await producciones.listarProducciones() });
}));

/**
 * Lotes cuyos frascos quedaron en la ficha equivocada, o no quedaron. Solo lee:
 * las acciones son la carga inicial y el PATCH del lote, que ya existen.
 */
inventarioRouter.get('/producciones/por-enlazar', h(async (_req, res) => {
  res.json({ data: await lotesPorEnlazar() });
}));

/**
 * Crea la ficha 1.1 que le falta a un lote y le manda sus frascos.
 *
 * Nace apagada y en la pestaña Productos: el dueño le pone foto propia, precio
 * y notas cuando quiera, sin que ningún cliente la vea a medio llenar.
 */
inventarioRouter.post('/producciones/:id/ficha-1-1', validate(fichaDeLoteSchema), h(async (req, res) => {
  const data = await crearFicha11YEnlazar(Number(req.params.id), req.body.nombre);
  bustCatalogoCache();
  res.status(201).json({
    message: `"${data.nombre}" quedó creado en Productos, fuera de la tienda, con sus frascos`,
    data,
  });
}));

/** Manda los frascos de un lote a una ficha que ya existe. */
inventarioRouter.post('/producciones/:id/enlazar', validate(enlazarLoteSchema), h(async (req, res) => {
  await mandarFrascosAlaFicha(Number(req.params.id), req.body.perfume_id);
  bustCatalogoCache();
  res.json({ message: 'Listo: esos frascos ya están en su ficha, con su costo' });
}));

/** Registra un lote armado y descuenta sus insumos. */
inventarioRouter.post('/producciones', validate(produccionSchema), h(async (req, res) => {
  const data = await producciones.registrarProduccion(req.body);
  bustCatalogoCache();
  res.status(201).json({ message: 'Producción registrada', data });
}));

/**
 * Carga inicial: frascos que ya existían. NO descuenta material (ver el porqué
 * en `inventario.terminado.ts`) y por eso NO es una producción: no crea lote.
 */
inventarioRouter.post('/terminado/carga-inicial', validate(cargaInicialArmadosSchema), h(async (req, res) => {
  const { fecha, ...resto } = req.body;
  const data = await cargaInicialArmados({ ...resto, fecha: new Date(fecha) });
  bustCatalogoCache();
  res.status(201).json({ message: 'Frascos agregados a tu inventario de armados', data });
}));

/**
 * Corrige un lote ya registrado: deshace y rehace material, frascos y costo.
 * PATCH y no PUT: el CORS del proyecto solo permite GET/POST/PATCH/DELETE.
 */
inventarioRouter.patch('/producciones/:id', validate(produccionEdicionSchema), h(async (req, res) => {
  const data = await producciones.editarProduccion(Number(req.params.id), req.body);
  bustCatalogoCache();
  res.json({ message: 'Lote corregido: el material y los frascos quedaron al día', data });
}));

inventarioRouter.delete('/producciones/:id', h(async (req, res) => {
  await producciones.eliminarProduccion(Number(req.params.id));
  bustCatalogoCache();
  res.json({ message: 'Producción eliminada; los insumos volvieron al inventario' });
}));
