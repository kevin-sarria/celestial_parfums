import type { Insumo } from './cotizacion.types';

/**
 * ¿Este material es una esencia?
 *
 * **Lo dice su GAMA, no su nombre.** El diluyente, el sellador y las feromonas
 * también son materia prima, así que hace falta algo que distinga; desde que
 * existe la tabla de gamas (2026-08-09) ese algo es `gama_id`, que es
 * precisamente lo que significa: la calidad de una esencia.
 *
 * Antes se miraba si el nombre contenía "esencia", y eso dejaba materiales
 * INUTILIZABLES sin decir por qué: una esencia que se llame "Herod by Parfums
 * de Marly" no aparecía en el formulario del perfume por más que estuviera
 * clasificada y con stock. Peor: como el modal del material solo enseñaba la
 * casilla de gama a los que ya tenían "esencia" en el nombre, tampoco se podía
 * clasificar — un círculo cerrado. Medido sobre los datos reales el
 * 2026-08-13: **5 esencias atrapadas** de 227.
 *
 * Al cambiar el criterio no se pierde ninguna: no hay una sola esencia con el
 * nombre "correcto" que esté sin gama.
 */
export const esEsencia = (i: Pick<Insumo, 'tipo' | 'gama_id'>): boolean =>
  i.tipo === 'materia_prima' && i.gama_id != null;
