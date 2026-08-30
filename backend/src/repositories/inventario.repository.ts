import { $Enums, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { r3, r4 } from '../utils/redondeo';

/**
 * Motor de inventario: stock y **costo promedio ponderado** de cada insumo.
 *
 * Regla de oro: nada se toca a mano. Todo entra y sale por un movimiento
 * (`movimientos_inventario`), y `insumos_costo.stock`/`precio` son la
 * proyección de ese libro. Así el costo que usan las cotizaciones y los
 * márgenes es el que de verdad pagaste, no uno tecleado hace tres meses.
 */

const num = (v: unknown) => Number(v);

import { aBase } from './inventario.compras';

/**
 * Sale del enum de Prisma, no de una copia a mano: cuando se agregó
 * `maceracion` al esquema, una lista escrita aquí se habría quedado atrás y el
 * compilador habría rechazado un tipo que la base sí acepta. Es la misma
 * lección de la limpieza de `any` (2026-08-23): los valores válidos los declara
 * el esquema.
 */
export type TipoMovimiento = $Enums.MovimientoTipo;

interface MovimientoNuevo {
  insumo_id: number;
  tipo: TipoMovimiento;
  /** Positiva entra, negativa sale. */
  cantidad: number;
  /** Solo para entradas: a qué costo llegó. Las salidas usan el promedio. */
  costo_unitario?: number;
  fecha: Date;
  referencia_id?: number | null;
  nota?: string | null;
}

/**
 * Aplica un movimiento y deja el stock y el costo promedio al día.
 *
 * ENTRADA (compra): el promedio se recalcula ponderando lo que ya había con
 * lo que llega:  (stock×promedio + cantidad×costo) / (stock + cantidad).
 * Es el estándar contable y evita que una compra cara de 50 ml te dispare el
 * costo de los 500 ml que ya tenías.
 *
 * SALIDA (producción, garantía, merma): se valora al promedio vigente y el
 * promedio NO cambia — sacar material no altera lo que costó.
 *
 * Debe llamarse SIEMPRE dentro de una transacción: el movimiento y la
 * proyección tienen que cuadrar o no vale ninguno de los dos.
 */
export const aplicarMovimiento = async (tx: Prisma.TransactionClient, mov: MovimientoNuevo) => {
  const insumo = await tx.insumoCosto.findUnique({ where: { id: mov.insumo_id } });
  if (!insumo) throw badRequest('El insumo no existe');

  const stockActual = num(insumo.stock);
  const promedioActual = num(insumo.precio);
  const entra = mov.cantidad > 0;

  let nuevoPromedio = promedioActual;
  const costoAplicado = entra
    ? r4(mov.costo_unitario ?? promedioActual)
    : r4(promedioActual);

  if (entra) {
    const totalUnidades = stockActual + mov.cantidad;
    // Con stock en cero (o negativo por un descuadre) el promedio es el de la
    // compra: ponderar contra nada daría una división rara.
    nuevoPromedio = stockActual > 0 && totalUnidades > 0
      ? r4((stockActual * promedioActual + mov.cantidad * costoAplicado) / totalUnidades)
      : costoAplicado;
  }

  const nuevoStock = r3(stockActual + mov.cantidad);

  await tx.movimientoInventario.create({
    data: {
      insumo_id: mov.insumo_id,
      tipo: mov.tipo,
      cantidad: mov.cantidad,
      costo_unitario: costoAplicado,
      fecha: mov.fecha,
      referencia_id: mov.referencia_id ?? null,
      nota: mov.nota ?? null,
    },
  });

  await tx.insumoCosto.update({
    where: { id: mov.insumo_id },
    data: { stock: nuevoStock, precio: nuevoPromedio },
  });

  return { stock: nuevoStock, promedio: nuevoPromedio, costoAplicado };
};


/**
 * Deshace los movimientos de una referencia (al borrar una compra o una
 * producción). Se recorre al revés para que el promedio se destense en el
 * orden inverso al que se armó.
 */
export const revertirMovimientos = async (
  tx: Prisma.TransactionClient, tipo: TipoMovimiento, referenciaId: number,
  /**
   * Devolver SOLO estos materiales. Sin la lista se devuelven todos, que es lo
   * normal. La usa la conversión de un lote a maceración: los envases vuelven a
   * la repisa, pero la esencia NO —está dentro del frasco que está reposando—.
   */
  soloInsumos?: number[],
) => {
  const filtro = {
    tipo,
    referencia_id: referenciaId,
    ...(soloInsumos ? { insumo_id: { in: soloInsumos } } : {}),
  };
  const movs = await tx.movimientoInventario.findMany({
    where: filtro,
    orderBy: { id: 'desc' },
  });
  for (const m of movs) {
    const insumo = await tx.insumoCosto.findUnique({ where: { id: m.insumo_id } });
    if (!insumo) continue;
    const stock = num(insumo.stock) - num(m.cantidad);
    await tx.insumoCosto.update({
      where: { id: m.insumo_id },
      data: { stock: r3(stock) },
    });
  }
  await tx.movimientoInventario.deleteMany({ where: filtro });
  // El promedio se reconstruye del libro: revertirlo "a ojo" lo iría torciendo
  const insumos = [...new Set(movs.map((m) => m.insumo_id))];
  for (const id of insumos) await recalcularPromedio(tx, id);
};

/**
 * Reconstruye el costo promedio de un insumo recorriendo su libro de
 * movimientos desde cero. Es la red de seguridad: si algo se descuadra,
 * este es el número correcto.
 */
export const recalcularPromedio = async (tx: Prisma.TransactionClient, insumoId: number) => {
  const movs = await tx.movimientoInventario.findMany({
    where: { insumo_id: insumoId },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });
  let stock = 0;
  let promedio = 0;
  for (const m of movs) {
    const cant = num(m.cantidad);
    if (cant > 0) {
      const total = stock + cant;
      promedio = stock > 0 && total > 0
        ? r4((stock * promedio + cant * num(m.costo_unitario)) / total)
        : r4(num(m.costo_unitario));
    }
    stock += cant;
  }
  await tx.insumoCosto.update({
    where: { id: insumoId },
    data: { stock: r3(stock), ...(movs.length ? { precio: promedio } : {}) },
  });
  return { stock: r3(stock), promedio };
};

/** Movimientos de un insumo, para la ficha de inventario del dashboard. */
export const movimientosDeInsumo = async (insumoId: number, limite = 100) => {
  const rows = await prisma.movimientoInventario.findMany({
    where: { insumo_id: insumoId },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: limite,
  });
  return rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    cantidad: num(m.cantidad),
    costo_unitario: num(m.costo_unitario),
    fecha: m.fecha.toISOString().slice(0, 10),
    referencia_id: m.referencia_id,
    nota: m.nota,
  }));
};

// ── Ajustes por conteo físico ───────────────────────────────────────────────

/**
 * "Conté y tengo X": el sistema calcula la diferencia contra el stock actual y
 * la registra como movimiento. Sirve para sembrar el stock inicial (de 0 a lo
 * que haya) y para corregir mermas o roturas.
 */
export const ajustarStock = async (data: {
  insumo_id: number; cantidad_final: number; costo_unitario?: number;
  stock_minimo?: number | null; fecha: string; nota?: string | null;
}) => prisma.$transaction(async (tx) => {
  const insumo = await tx.insumoCosto.findUnique({ where: { id: data.insumo_id } });
  if (!insumo) throw badRequest('El insumo no existe');
  // El punto de pedido se guarda siempre, aunque la cantidad no cambie
  if (data.stock_minimo != null) {
    await tx.insumoCosto.update({
      where: { id: data.insumo_id }, data: { stock_minimo: data.stock_minimo },
    });
  }
  const delta = r3(data.cantidad_final - num(insumo.stock));
  if (delta === 0) return { sinCambios: true, stock: num(insumo.stock), promedio: num(insumo.precio) };

  const res = await aplicarMovimiento(tx, {
    insumo_id: data.insumo_id,
    tipo: 'ajuste',
    cantidad: delta,
    // Solo pesa si entra material; al sacar se valora al promedio vigente
    costo_unitario: delta > 0 ? data.costo_unitario : undefined,
    fecha: new Date(data.fecha),
    nota: data.nota ?? (delta > 0 ? 'Ajuste: entra material' : 'Ajuste: sale material'),
  });
  return { sinCambios: false, ...res, delta };
});


/** Foto del inventario para el dashboard: qué hay y cuánto vale. */
/**
 * Qué hay en bodega.
 *
 * Incluye los APAGADOS a propósito, al final y marcados: es la pantalla donde
 * el dueño trabaja con sus materiales, así que también es donde los jubila y
 * donde tiene que poder volver a encenderlos. Filtrarlos aquí dejaría un insumo
 * apagado sin ninguna pantalla desde la cual recuperarlo.
 *
 * Los totales sí cuentan SOLO los activos: un material jubilado ya no es parte
 * de lo que tienes para trabajar.
 */
/**
 * El punto de pedido que de verdad aplica a un material.
 *
 * El propio MANDA sobre el de su gama; sin él se hereda el de la gama. Esa
 * herencia es la que hace usable la alerta: configurar 219 esencias a mano no
 * lo hace nadie (se midió: solo 1 de 226 lo tenía puesto), pero configurar
 * "las árabes" una vez sí.
 *
 * `null` en el material = "no he dicho nada, usa el de mi gama".
 * `0` = "no me avises nunca", y por eso gana sobre la gama igual que cualquier
 * otro valor propio.
 */
const minimoEfectivo = (i: { stock_minimo: unknown; gama?: { stock_minimo: unknown } | null }) => {
  if (i.stock_minimo != null) return { minimo: num(i.stock_minimo), heredado: false };
  if (i.gama) return { minimo: num(i.gama.stock_minimo), heredado: true };
  return { minimo: 0, heredado: false };
};

export const resumenInventario = async () => {
  const insumos = await prisma.insumoCosto.findMany({
    include: { gama: true },
    orderBy: [{ activo: 'desc' }, { tipo: 'asc' }, { nombre: 'asc' }],
  });
  const filas = insumos.map((i) => {
    const stock = num(i.stock);
    const precio = num(i.precio);
    const { minimo, heredado } = minimoEfectivo(i);
    return {
      id: i.id,
      nombre: i.nombre,
      tipo: i.tipo,
      unidad: i.unidad,
      /** Solo esencias: su gama. Null en envases, accesorios y el resto. */
      gama_id: i.gama_id ?? null,
      gama_nombre: i.gama?.nombre ?? null,
      /** Solo esencias: para quién es la fragancia. Null = todavía sin decir. */
      genero: i.genero ?? null,
      activo: i.activo,
      stock,
      stock_minimo: minimo,
      /** true = el mínimo sale de su gama, no es propio de este material. */
      minimo_heredado: heredado,
      // Con mínimo en 0 la alerta está apagada: no todo insumo la necesita.
      // Un apagado nunca alerta: ya no se compra.
      bajo_minimo: i.activo && minimo > 0 && stock <= minimo,
      /** Cuánto pedir para volver al doble del mínimo (colchón razonable). */
      sugerido: i.activo && minimo > 0 && stock <= minimo ? Math.max(0, Math.round((minimo * 2 - stock) * 1000) / 1000) : 0,
      costo_promedio: precio,
      valor: Math.round(stock * precio * 100) / 100,
    };
  });
  return {
    insumos: filas,
    // Solo lo activo: lo jubilado no cuenta como inventario de trabajo
    valor_total: Math.round(filas.filter((f) => f.activo).reduce((s, f) => s + f.valor, 0) * 100) / 100,
  };
};


/**
 * Saca material sin que haya venta: muestras del mostrario, minis de regalo o
 * una merma identificada. Se valora al costo promedio vigente, así sabes
 * cuánta plata se va por cada vía.
 *
 * El desperdicio pequeño del día a día (los gramos que se van de más al
 * servir) NO hace falta anotarlo uno por uno: el conteo físico lo absorbe.
 */
export const registrarSalida = async (data: {
  insumo_id: number; cantidad: number; unidad: string;
  motivo: 'muestra' | 'merma'; fecha: string; nota?: string | null;
}) => prisma.$transaction(async (tx) => {
  const cantidad = aBase(data.cantidad, data.unidad);
  if (cantidad <= 0) throw badRequest('La cantidad debe ser mayor a 0');
  const res = await aplicarMovimiento(tx, {
    insumo_id: data.insumo_id,
    tipo: data.motivo,
    cantidad: -cantidad,
    fecha: new Date(data.fecha),
    nota: data.nota ?? (data.motivo === 'muestra' ? 'Muestra / mostrario' : 'Merma'),
  });
  return { ...res, costo: Math.round(res.costoAplicado * cantidad * 100) / 100 };
});

/** Cuánto se ha ido este mes por muestras, mermas y ajustes (para el resumen). */
export const salidasDelMes = async () => {
  const ahora = new Date();
  const inicio = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1));
  const movs = await prisma.movimientoInventario.findMany({
    where: { fecha: { gte: inicio }, tipo: { in: ['muestra', 'merma', 'ajuste'] } },
  });
  const suma = (tipo: string) => Math.round(movs
    .filter((m) => m.tipo === tipo && num(m.cantidad) < 0)
    .reduce((s, m) => s + Math.abs(num(m.cantidad)) * num(m.costo_unitario), 0) * 100) / 100;
  return { muestras: suma('muestra'), mermas: suma('merma'), ajustes: suma('ajuste') };
};


/** Perfumes que ya se vendieron pero no tienen esencia asignada (para configurar). */
export const perfumesSinCostear = async () => {
  const rows = await prisma.perfume.findMany({
    where: {
      ventas: { some: {} },
      OR: [
        { tipo_producto: 'fabricado', insumo_esencia_id: null },
        { tipo_producto: { in: ['comprado', 'fraccionado'] }, insumo_producto_id: null },
      ],
    },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
    take: 100,
  });
  return rows;
};

/**
 * Progreso del arranque del inventario, para la lista de "Primeros pasos".
 *
 * Se deduce SIEMPRE de los datos reales, nunca de una bandera de "ya lo hizo":
 * una bandera mentiría el día que se cargue algo por Excel o se borre un
 * registro, y quien ya tiene su inventario andando nunca debe ver la lista.
 */
export const primerosPasos = async () => {
  // Solo los FABRICADOS necesitan esencia: una gorra o un splash comprado no
  // lleva receta. Contra el total de perfumes, el paso nunca se completaría.
  const fabricado = { tipo_producto: 'fabricado' as const };
  const [materiales, conteos, compras, faltanEsencia, fabricados] = await Promise.all([
    prisma.insumoCosto.count(),
    prisma.movimientoInventario.count({ where: { tipo: 'ajuste' } }),
    prisma.compraItem.count(),
    prisma.perfume.count({ where: { ...fabricado, insumo_esencia_id: null } }),
    prisma.perfume.count({ where: fabricado }),
  ]);
  return { materiales, conteos, compras, faltan_esencia: faltanEsencia, fabricados };
};
