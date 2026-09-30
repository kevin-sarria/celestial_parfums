import type { Perfume, PrecioPresentacion } from './perfume.schema';

/**
 * LAS LÍNEAS DE LA TIENDA, como las lee el cliente (dueño, 2026-09-29).
 *
 * Contratipo, 1.1 y original se venden lado a lado y cuestan muy distinto: si la
 * tarjeta no dice cuál es cuál, el cliente compara un decant original con un
 * contratipo de 100 ml y cree que algo está mal. La línea la deduce el servidor
 * (`lineaDe` en `perfume.mapeo.ts`); aquí solo vive cómo se nombra.
 */
export type Linea = Perfume['linea'];

/** El nombre de cada línea en la tienda. null = no se le pone etiqueta. */
export const NOMBRE_LINEA: Record<Linea, string | null> = {
  contratipo: 'Contratipo',
  '1.1': '1.1',
  original: 'Original',
  accesorio: null,
  producto: null,
};

/**
 * Cómo se llama una talla para el cliente.
 *
 * En un original, "5ML" y "100ML" no dicen lo que importa: que uno es un decant
 * servido de la botella y el otro la botella cerrada. En el resto se deja la
 * etiqueta de siempre, que es la que ya conocen.
 */
export const etiquetaTalla = (
  linea: Linea,
  t: Pick<PrecioPresentacion, 'presentacion' | 'ml' | 'botella_completa'>,
) => {
  if (linea !== 'original' || t.ml == null) return t.presentacion;
  return t.botella_completa ? `Botella ${t.ml} ml` : `Decant ${t.ml} ml`;
};
