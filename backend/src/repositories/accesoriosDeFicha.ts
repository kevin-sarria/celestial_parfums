import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

type Cliente = Prisma.TransactionClient | typeof prisma;

/**
 * QUÉ ACCESORIOS LLEVA UN FRASCO: la regla, en un solo sitio.
 *
 * La receta de cada tamaño trae sus accesorios (el de 100 ml: bolsa de organza
 * y perfumero). Una ficha puede decir otra cosa para ESA talla, y la regla es:
 *
 *   - `null`  → hereda los de la receta (lo normal).
 *   - `[]`    → **ninguno**. Un 1.1 no lleva bolsa ni perfumero (dueño,
 *               2026-08-30: "actualmente el coste no es el real").
 *   - `[ids]` → los suyos, en vez de los de la receta.
 *
 * Antes la lista vacía significaba "hereda", así que no había forma de decir
 * "ninguno", y la regla vivía en TRES sitios que decían cosas distintas: la
 * venta miraba la ficha, el envasado solo la receta, y el lote la armaba la
 * PANTALLA con los de la receta. Medido el 2026-09-27: los 27 lotes 1.1 de
 * producción cargaron una bolsa de organza que nunca usaron ($8.100).
 */

/** Lo guardado en `perfume_presentacion.accesorios`, sin perder la diferencia entre null y []. */
export const accesoriosPropios = (v: Prisma.JsonValue | null | undefined): number[] | null =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : null;

export const accesoriosEfectivos = (propios: number[] | null, deLaReceta: number[]) =>
  propios ?? deLaReceta;

/**
 * Los accesorios de UN frasco de esta receta para esta ficha. Sin ficha (un
 * lote registrado sin decir la fragancia), los de la receta.
 */
export const accesoriosDeLote = async (cli: Cliente, formulaId: number, perfumeId: number | null) => {
  const [receta, talla] = await Promise.all([
    cli.formulaAccesorio.findMany({ where: { formula_volumen_id: formulaId }, select: { insumo_id: true } }),
    perfumeId
      ? cli.presentacion.findFirst({
          where: { formula_volumen_id: formulaId },
          select: { perfumes: { where: { perfume_id: perfumeId }, select: { accesorios: true } } },
        })
      : null,
  ]);
  return accesoriosEfectivos(
    accesoriosPropios(talla?.perfumes[0]?.accesorios),
    receta.map((a) => a.insumo_id),
  );
};

interface LoteConConsumos {
  formula_volumen_id: number;
  perfume_id?: number | null;
  cantidad: number;
  consumos: { insumo_id: number; cantidad: number }[];
}

/**
 * Deja los accesorios de un lote como dice la ficha, venga lo que venga.
 *
 * La pantalla de "armé directo" manda los consumos ya calculados. Aquí se
 * quita cualquier accesorio de la receta que traiga y se ponen los que tocan:
 * el servidor manda, así que una pestaña abierta con la versión vieja de la
 * pantalla tampoco cobra una bolsa que no se usó.
 */
export const conAccesoriosDeFicha = async <T extends LoteConConsumos>(cli: Cliente, lote: T): Promise<T> => {
  const [receta, efectivos] = await Promise.all([
    cli.formulaAccesorio.findMany({ where: { formula_volumen_id: lote.formula_volumen_id }, select: { insumo_id: true } }),
    accesoriosDeLote(cli, lote.formula_volumen_id, lote.perfume_id ?? null),
  ]);
  const fuera = new Set([...receta.map((a) => a.insumo_id), ...efectivos]);
  return {
    ...lote,
    consumos: [
      ...lote.consumos.filter((c) => !fuera.has(c.insumo_id)),
      ...efectivos.map((insumo_id) => ({ insumo_id, cantidad: lote.cantidad })),
    ],
  };
};

/** Los mismos, como consumos de un lote de `cantidad` frascos. */
export const consumosDeAccesorios = async (
  cli: Cliente, formulaId: number, perfumeId: number | null, cantidad: number,
) => (await accesoriosDeLote(cli, formulaId, perfumeId)).map((insumo_id) => ({ insumo_id, cantidad }));
