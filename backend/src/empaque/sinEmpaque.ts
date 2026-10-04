import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

type Cliente = Prisma.TransactionClient | typeof prisma;

/**
 * EL EMPAQUE SALE AL VENDER, NUNCA AL ARMAR (dueño, 2026-10-04).
 *
 * La bolsa y el perfumero ya no van en la receta: los regala la venta, a la
 * vista, según la línea y la talla o el combo (`empaque/`). Así que un lote
 * —armado directo o envasado de una tanda— no gasta empaque, aunque la
 * pantalla vieja de una pestaña abierta lo mande: el servidor manda.
 *
 * "Material de empaque" = el que es el producto de un accesorio (la bolsa de
 * organza, el perfumero). Antes vivía en `formula_accesorios` y la ficha de
 * cada talla (`accesoriosDeFicha.ts`, retirado); medido el 2026-09-27, los
 * 27 lotes 1.1 cargaron una bolsa que nunca usaron.
 */
export const insumosDeEmpaque = async (cli: Cliente = prisma): Promise<Set<number>> => {
  const filas = await cli.perfume.findMany({
    where: { es_accesorio: true, insumo_producto_id: { not: null } },
    select: { insumo_producto_id: true },
  });
  return new Set(filas.map((f) => f.insumo_producto_id!));
};

/**
 * Los consumos de un lote, sin el material de empaque. El frasco del propio
 * lote se queda aunque sea ese mismo material: si un día el perfumero de 6 ml
 * es el envase de un tamaño, ahí es el frasco, no el regalo.
 */
export const sinEmpaque = async <T extends {
  consumos: { insumo_id: number; cantidad: number }[];
  envase_insumo_id?: number | null;
}>(cli: Cliente, lote: T): Promise<T> => {
  const empaque = await insumosDeEmpaque(cli);
  return {
    ...lote,
    consumos: lote.consumos.filter((c) => c.insumo_id === lote.envase_insumo_id || !empaque.has(c.insumo_id)),
  };
};
