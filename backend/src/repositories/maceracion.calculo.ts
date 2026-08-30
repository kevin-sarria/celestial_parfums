import { r3, r4 } from '../utils/redondeo';

/**
 * LA ARITMÉTICA DE MACERAR Y ENVASAR, sin base de datos.
 *
 * Vive aparte porque es lo único que se puede comprobar con números reales sin
 * montar nada: la regla que cierra todo el diseño es que **macerar y envasar
 * tiene que costar lo mismo que armar directo** (`docs/superpowers/specs/
 * 2026-08-24-maceracion-y-envasado-design.md`). Si esa igualdad se rompe, el
 * dueño ve un costo distinto según cómo trabajó ese día, que es exactamente lo
 * que no puede pasar.
 */

/** Lo que una receta reparte en cada ml, ya escalado a la tanda. */
export interface Reparto {
  esencia: number;
  diluyente: number;
  sellador: number;
  feromonas: number;
}

export interface RecetaBase {
  ml_total: number;
  esencia_ml: number;
  sellador_ml: number;
  feromonas_ml: number;
}

/**
 * Escala la proporción de una receta a los ml que se van a macerar.
 *
 * Se escala una receta EXISTENTE en vez de pedir una proporción nueva: así el
 * granel sale con una concentración que alguna talla usa de verdad, y no con
 * una inventada a ojo. Es el mismo motor que ya costea las cotizaciones.
 *
 * **El diluyente es el RESTO, no un escalado propio.** Igual que en
 * `recetaDe`: así los cuatro sumados dan exactamente los ml pedidos y no se
 * pierde ni se inventa líquido por redondeo.
 */
export const escalarReceta = (receta: RecetaBase, ml: number): Reparto => {
  const factor = ml / receta.ml_total;
  const esencia = r3(receta.esencia_ml * factor);
  const sellador = r3(receta.sellador_ml * factor);
  const feromonas = r3(receta.feromonas_ml * factor);
  return { esencia, sellador, feromonas, diluyente: r3(ml - esencia - sellador - feromonas) };
};

/**
 * Costo de UN ml de granel, congelado el día de la mezcla.
 *
 * Se guarda con seis decimales a propósito: con 500 ml, un céntimo de más por
 * ml son cinco pesos por frasco, y esa diferencia es justo la que rompería la
 * igualdad con el armado directo.
 */
export const costoPorMl = (costoTotal: number, ml: number) =>
  (ml > 0 ? Math.round((costoTotal / ml) * 1_000_000) / 1_000_000 : 0);

/**
 * Lo que cuesta cada frasco al envasar: el líquido que se lleva más lo que se
 * le pone encima. La esencia NO entra aquí — ya se pagó al macerar.
 */
export const costoDelFrasco = (
  costoMl: number, mlDeLaTalla: number, costoEnvaseYAccesorios: number,
) => r4(costoMl * mlDeLaTalla + costoEnvaseYAccesorios);

/**
 * Lo que queda en el frasco: lo que se puso menos lo envasado y la merma.
 *
 * **No se guarda en ninguna columna**, se recalcula siempre (regla de la casa).
 * Aquí se gana algo concreto: el día que el dueño corrija o borre un envasado
 * viejo, el saldo se corrige solo en vez de quedarse mintiendo.
 */
export const saldoDeTanda = (
  mlIniciales: number,
  envasados: { cantidad: number; ml: number }[],
  mlMerma = 0,
) => r3(mlIniciales - envasados.reduce((t, e) => t + e.cantidad * e.ml, 0) - mlMerma);
