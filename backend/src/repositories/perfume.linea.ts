import { Prisma } from '@prisma/client';

/**
 * LAS CUATRO LÍNEAS DEL CATÁLOGO DEL PANEL (2026-10-04, proyecto 3 del rediseño
 * del núcleo de producto).
 *
 * El dueño piensa en LÍNEAS, no en "existe antes de venderse": un contratipo, un
 * 1.1, un original, un perfumero. La partición vieja (`familia`: Perfumes/Productos)
 * metía un original entre los contratipos y un 1.1 entre los accesorios.
 *
 * Los predicados de abajo coinciden EXACTO con `lineaDe` de `perfume.mapeo.ts`
 * (mismo orden de preguntas): si uno preguntara al revés, la pestaña y la
 * etiqueta de la fila dirían cosas distintas.
 *
 * `contratipo` es el COMPLEMENTO, no una lista paralela: dos listas se
 * desincronizan el día que el enum crezca y lo que caiga en el hueco desaparece
 * de todas las pestañas sin avisar (ya pasó con `fraccionado` en la primera
 * versión de dos familias).
 */
export type LineaCatalogo = 'contratipo' | 'uno_uno' | 'original' | 'producto';

const NO_ACCESORIO = { es_accesorio: false } satisfies Prisma.PerfumeWhereInput;
const UNO_UNO = { es_accesorio: false, solo_armado: true } satisfies Prisma.PerfumeWhereInput;
const ORIGINAL = { es_accesorio: false, solo_armado: false, tipo_producto: 'fraccionado' } satisfies Prisma.PerfumeWhereInput;
const COMPRADO = { es_accesorio: false, solo_armado: false, tipo_producto: 'comprado' } satisfies Prisma.PerfumeWhereInput;

export const WHERE_LINEA: Record<LineaCatalogo, Prisma.PerfumeWhereInput> = {
  contratipo: {
    AND: [
      NO_ACCESORIO,
      { solo_armado: false },
      { NOT: { tipo_producto: { in: ['fraccionado', 'comprado'] } } },
    ],
  },
  uno_uno: UNO_UNO,
  original: ORIGINAL,
  // La pestaña 4 agrupa DOS líneas: accesorios + comprados. Es la partición
  // vieja (`solo_armado` / `comprado`) reescrita en positivo.
  producto: { OR: [{ es_accesorio: true }, COMPRADO] },
};

export const esLinea = (v: string): v is LineaCatalogo =>
  Object.prototype.hasOwnProperty.call(WHERE_LINEA, v);

/**
 * A qué pestaña va una ficha: la misma pregunta que `lineaDe` (perfume.mapeo.ts),
 * colapsada a las 4 pestañas —accesorio y comprado comparten la de productos—.
 */
export const lineaDeCatalogo = (d: {
  solo_armado?: boolean;
  tipo_producto?: string;
  es_accesorio?: boolean;
}): LineaCatalogo => {
  if (d.es_accesorio) return 'producto';
  if (d.solo_armado) return 'uno_uno';
  if (d.tipo_producto === 'fraccionado') return 'original';
  if (d.tipo_producto === 'comprado') return 'producto';
  return 'contratipo';
};

/** El id de pestaña del panel que abre cada línea (coincide con el union `Tab`). */
export const TAB_DE_LINEA: Record<LineaCatalogo, string> = {
  contratipo: 'contratipos',
  uno_uno: 'uno_uno',
  original: 'originales',
  producto: 'productos',
};

/**
 * ¿Esta ficha nace apagada (fuera de la tienda)?
 *
 * Un contratipo sale publicado de una sentada. Un 1.1, un comprado o un original
 * nace a medio llenar (falta foto, precio de talla, insumo) y no debe enseñarse
 * hasta completarse. El `publicado` explícito sigue mandando sobre la regla.
 */
export const naceApagado = (d: { solo_armado?: boolean; tipo_producto?: string }) =>
  (d.solo_armado ?? false) ||
  d.tipo_producto === 'comprado' ||
  d.tipo_producto === 'fraccionado';
