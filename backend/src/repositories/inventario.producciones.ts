import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { r4 } from '../utils/redondeo';
import { hoyEnColombia } from '../utils/fechas';
import { aplicarMovimiento, revertirMovimientos } from './inventario.repository';
import {
  aplicarMovimientoTerminado, recalcularPromedioTerminado, revertirTerminado, tallaDeFormula,
} from './inventario.terminado';
import { agregarLinea, describirCambios, type FotoLote } from './producciones.historial';

/**
 * LOTES DE PRODUCCIÓN: armar frascos por adelantado.
 *
 * Un lote hace TRES cosas al registrarse: descuenta el material, congela su
 * costo y suma los frascos a una ficha×talla. Editarlo es deshacerlas y
 * rehacerlas dentro de una transacción, y por eso el alta y la edición
 * comparten `aplicarLote`: dos copias de esa lógica acabarían diciendo cosas
 * distintas.
 *
 * Vive fuera de `inventario.repository.ts` porque ese archivo ya rondaba las
 * 600 líneas y esto es una responsabilidad propia.
 */

const num = (v: unknown) => Number(v);

// ── Producción ──────────────────────────────────────────────────────────────

export interface LoteInput {
  fecha: string; formula_volumen_id: number; cantidad: number;
  perfume_id?: number | null; envase_insumo_id?: number | null;
  consumos: { insumo_id: number; cantidad: number }[]; nota?: string | null;
  /** Manda sobre el calculado. Sin él, el costo sale de los materiales. */
  costo_unitario?: number | null;
  /** true = lo escribió una persona. Lo declara quien llama; no se adivina. */
  costo_manual?: boolean;
}

/**
 * Descuenta el material del lote, calcula su costo y suma los frascos armados.
 *
 * La comparten el alta y la edición —una regla vive en UN solo sitio—, y el
 * lote ya existe en la base cuando se llama, porque los movimientos apuntan a
 * él por `referencia_id`.
 */
const aplicarLote = async (tx: Prisma.TransactionClient, loteId: number, data: LoteInput) => {
  const fecha = new Date(data.fecha);

  let costoTotal = 0;
  for (const c of data.consumos) {
    const res = await aplicarMovimiento(tx, {
      insumo_id: c.insumo_id,
      tipo: 'produccion',
      cantidad: -Math.abs(c.cantidad),
      fecha,
      referencia_id: loteId,
      nota: `Lote de ${data.cantidad} u`,
    });
    costoTotal += res.costoAplicado * Math.abs(c.cantidad);
  }

  /**
   * Un costo que llega con el lote no siempre lo escribió una persona: al mudar
   * frascos de ficha se reenvía el costo CONGELADO justo para no revaluarlos al
   * promedio de hoy. Por eso la marca se declara y no se deduce de que venga un
   * número.
   */
  const traeCosto = typeof data.costo_unitario === 'number' && data.costo_unitario >= 0;
  const manual = data.costo_manual ?? traeCosto;

  const total = traeCosto
    ? Math.round((data.costo_unitario as number) * data.cantidad * 100) / 100
    : Math.round(costoTotal * 100) / 100;
  const costoUnitario = traeCosto ? r4(data.costo_unitario as number) : r4(total / data.cantidad);

  /**
   * Los frascos armados ENTRAN al stock de producto terminado.
   *
   * Sin esto, producir solo restaba materiales y al vender se volvían a restar:
   * el mismo frasco gastaba su esencia dos veces. Ver `inventario.terminado.ts`.
   *
   * Hace falta saber DE QUÉ perfume son: `perfume_id` es opcional (se puede
   * registrar "armé 20 de 30 ml" sin decir la fragancia), y en ese caso el lote
   * sigue descontando materiales pero no suma frascos — no se puede adivinar a
   * qué producto atribuirlos.
   */
  let presentacion_id: number | null = null;
  if (data.perfume_id) {
    presentacion_id = await tallaDeFormula(data.formula_volumen_id);
    if (presentacion_id) {
      await aplicarMovimientoTerminado(tx, {
        perfume_id: data.perfume_id,
        presentacion_id,
        tipo: 'produccion',
        cantidad: data.cantidad,
        costo_unitario: costoUnitario,
        fecha,
        referencia_id: loteId,
        nota: `Lote #${loteId}`,
      });
    }
  }

  return { total, costoUnitario, manual, presentacion_id };
};

/**
 * Registra un lote armado y descuenta sus insumos. El costo del lote se calcula
 * con el promedio VIGENTE de cada insumo y se congela: si mañana sube la
 * esencia, lo que costó este lote no cambia.
 */
export const registrarProduccion = async (data: LoteInput) => prisma.$transaction(async (tx) => {
  // Se crea primero para tener el id al que apuntan los movimientos
  const prod = await tx.produccion.create({
    data: {
      fecha: new Date(data.fecha),
      formula_volumen_id: data.formula_volumen_id,
      perfume_id: data.perfume_id ?? null,
      envase_insumo_id: data.envase_insumo_id ?? null,
      cantidad: data.cantidad,
      costo_unitario: 0,
      costo_total: 0,
      nota: data.nota ?? null,
    },
  });

  const res = await aplicarLote(tx, prod.id, data);

  return tx.produccion.update({
    where: { id: prod.id },
    data: { costo_total: res.total, costo_unitario: res.costoUnitario, costo_manual: res.manual },
    include: { formula: { select: { nombre: true } } },
  });
});

export const listarProducciones = async (limite = 60) => {
  const rows = await prisma.produccion.findMany({
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: limite,
    include: { formula: { select: { nombre: true } }, perfume: { select: { nombre: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    fecha: p.fecha.toISOString().slice(0, 10),
    formula_volumen_id: p.formula_volumen_id,
    volumen_nombre: p.formula?.nombre ?? '',
    perfume_nombre: p.perfume?.nombre ?? null,
    cantidad: p.cantidad,
    costo_unitario: num(p.costo_unitario),
    costo_total: num(p.costo_total),
    nota: p.nota,
    // Lo que la pantalla necesita para reabrir el lote tal como se guardó y para
    // marcar el costo que puso una persona.
    envase_insumo_id: p.envase_insumo_id,
    costo_manual: p.costo_manual,
    historial: Array.isArray(p.historial)
      ? p.historial as unknown as { fecha: string; texto: string }[]
      : [],
  }));
};

/** Nombre de un insumo para el historial; null si ya no existe. */
const nombreInsumo = async (tx: Prisma.TransactionClient, id: number | null) => (id
  ? (await tx.insumoCosto.findUnique({ where: { id }, select: { nombre: true } }))?.nombre ?? null
  : null);

/**
 * EDITAR un lote: deshacer y rehacer, dentro de una sola transacción.
 *
 * O pasan las cuatro cosas —devolver el material, quitar los frascos, volver a
 * descontar y volver a sumar— o no pasa ninguna: a mitad de camino el
 * inventario mentiría. El promedio de las fichas tocadas (la vieja y la nueva)
 * se reconstruye del libro al final, que es lo que permite mudar frascos de
 * ficha sin descuadrar su costo.
 */
export const editarProduccion = async (id: number, data: LoteInput) => prisma.$transaction(async (tx) => {
  const antes = await tx.produccion.findUnique({
    where: { id },
    include: { formula: { select: { nombre: true } }, perfume: { select: { nombre: true } } },
  });
  if (!antes) throw badRequest('Ese lote ya no existe: alguien lo borró mientras lo editabas');

  const fichasViejas = await tx.movimientoTerminado.findMany({
    where: { tipo: 'produccion', referencia_id: id },
    select: { perfume_id: true, presentacion_id: true },
  });

  const foto: FotoLote = {
    // Fecha de CALENDARIO: la columna es `@db.Date` y Prisma la lee a medianoche
    // UTC, así que cortar el ISO da el día correcto sin correrlo.
    fecha: antes.fecha.toISOString().slice(0, 10),
    cantidad: antes.cantidad,
    perfume: antes.perfume?.nombre ?? null,
    volumen: antes.formula?.nombre ?? '',
    envase: await nombreInsumo(tx, antes.envase_insumo_id),
    costo_unitario: num(antes.costo_unitario),
    costo_manual: antes.costo_manual,
  };

  await revertirMovimientos(tx, 'produccion', id);
  await revertirTerminado(tx, 'produccion', id);

  await tx.produccion.update({
    where: { id },
    data: {
      fecha: new Date(data.fecha),
      formula_volumen_id: data.formula_volumen_id,
      perfume_id: data.perfume_id ?? null,
      envase_insumo_id: data.envase_insumo_id ?? null,
      cantidad: data.cantidad,
      nota: data.nota ?? null,
    },
  });

  const res = await aplicarLote(tx, id, data);

  const formula = await tx.formulaVolumen.findUnique({
    where: { id: data.formula_volumen_id }, select: { nombre: true },
  });
  const perfume = data.perfume_id
    ? await tx.perfume.findUnique({ where: { id: data.perfume_id }, select: { nombre: true } })
    : null;

  const texto = describirCambios(foto, {
    fecha: data.fecha.slice(0, 10),
    cantidad: data.cantidad,
    perfume: perfume?.nombre ?? null,
    volumen: formula?.nombre ?? '',
    envase: await nombreInsumo(tx, data.envase_insumo_id ?? null),
    costo_unitario: res.costoUnitario,
    costo_manual: res.manual,
  });

  const actualizado = await tx.produccion.update({
    where: { id },
    data: {
      costo_total: res.total,
      costo_unitario: res.costoUnitario,
      costo_manual: res.manual,
      // El cast es por el tipo de una columna JSON en Prisma, que no acepta una
      // lista tipada tal cual. La forma la garantiza `agregarLinea`.
      ...(texto
        ? {
          historial: agregarLinea(
            antes.historial, hoyEnColombia().toISOString().slice(0, 10), texto,
          ) as unknown as Prisma.InputJsonValue,
        }
        : {}),
    },
    include: { formula: { select: { nombre: true } } },
  });

  // Las fichas de ANTES y la de ahora: mudar frascos de una a otra deja a las
  // dos con un promedio que hay que rehacer.
  const fichas = new Map<string, { perfume_id: number; presentacion_id: number }>();
  for (const f of fichasViejas) fichas.set(`${f.perfume_id}|${f.presentacion_id}`, f);
  if (data.perfume_id && res.presentacion_id) {
    fichas.set(`${data.perfume_id}|${res.presentacion_id}`, {
      perfume_id: data.perfume_id, presentacion_id: res.presentacion_id,
    });
  }
  for (const f of fichas.values()) await recalcularPromedioTerminado(tx, f.perfume_id, f.presentacion_id);

  return actualizado;
});

/** Borrar un lote devuelve sus insumos al inventario. */
export const eliminarProduccion = (id: number) => prisma.$transaction(async (tx) => {
  await revertirMovimientos(tx, 'produccion', id);
  // Devuelve los materiales Y quita los frascos que ese lote había armado.
  await revertirTerminado(tx, 'produccion', id);
  return tx.produccion.delete({ where: { id } });
});
