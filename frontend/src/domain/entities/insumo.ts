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

/** Lo mínimo que hace falta de un material para ofrecerlo en un desplegable. */
export interface MaterialOfrecible {
  id: number;
  nombre: string;
  stock: number;
  /** Apagado = jubilado: no se ofrece ni al comprar ni al producir. */
  activo: boolean;
}

/** Una opción de desplegable con su letra pequeña. Encaja en `BuscadorSelect`. */
export interface OpcionConExistencias {
  id: number;
  nombre: string;
  /** Letra pequeña a la derecha: "quedan 24" o "sin existencias". */
  nota: string;
  /** En gris: se puede elegir igual, pero no hay de eso en la bodega. */
  atenuada?: boolean;
}

/**
 * Ordenar y etiquetar los materiales de un desplegable que va a CONSUMIRLOS.
 *
 * Los que hay van arriba; los que están en cero caen al final, en gris y
 * diciéndolo. **No se esconden**, a propósito: registrar hoy una producción de
 * la semana pasada —cuando sí había envase— es un caso legítimo, y esconderlos
 * lo bloquearía. Lo que se arregla es que dejen de parecer disponibles.
 *
 * Lo encontró el dueño el 2026-08-23: los 5 envases 1.1 estaban en cero (cada
 * producción se llevó el suyo, que es correcto) y seguían mezclados con los
 * demás. El mismo descuido ya había dejado el Perfumero Recargable en −25
 * unidades.
 *
 * El orden de entrada se respeta entre los que sí hay: la lista llega ordenada
 * como el dueño la lee, y reordenarla por cantidad le movería el sitio de cada
 * envase cada vez que compra.
 */
export const opcionesPorExistencias = (
  materiales: MaterialOfrecible[],
): OpcionConExistencias[] => {
  const ofrecibles = materiales.filter((m) => m.activo);
  const hay = (m: MaterialOfrecible) => m.stock > 0;
  return [...ofrecibles.filter(hay), ...ofrecibles.filter((m) => !hay(m))].map((m) => ({
    id: m.id,
    nombre: m.nombre,
    ...(hay(m)
      ? { nota: `quedan ${m.stock}` }
      : { nota: 'sin existencias', atenuada: true }),
  }));
};
