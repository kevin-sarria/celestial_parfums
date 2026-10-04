import type { LineaEmpaque } from '@prisma/client';

/**
 * LO QUE LE TOCA DE EMPAQUE A UN PEDIDO (dueño, 2026-10-04).
 *
 * - Lo que cae en un combo lleva el KIT del combo, una vez por cada vez que
 *   se arma, y no el empaque de sus perfumes: el combo manda.
 * - Cada unidad suelta lleva el empaque de su línea y su talla.
 *
 * Función pura. OJO: está copiada en el panel
 * (`frontend/src/pages/dashboard/pedido/empaque.calculo.ts`), igual que la
 * detección de combos, porque front y back no comparten código: el panel la
 * usa para ofrecer el empaque y el servidor para saber que regalarlo no es un
 * descuento. Las dos tienen las mismas pruebas; si cambia una, cambia la otra.
 */

export interface ReglaEmpaque {
  linea: LineaEmpaque;
  /** null = vale para cualquier talla (solo `botella_completa`). */
  presentacion_id: number | null;
  /** El producto accesorio que se regala. */
  perfume_id: number;
  cantidad: number;
}

export interface UnidadPedido {
  /** null = no lleva empaque (un accesorio). */
  linea: LineaEmpaque | null;
  presentacion_id: number | null;
  /** Unidades COBRADAS de la línea (lo regalado no arma combo ni lleva empaque). */
  cantidad: number;
  /** Cuántas de esas unidades quedaron dentro de un combo. */
  enCombo: number;
}

export interface KitCombo {
  comboId: number;
  veces: number;
  kit: { perfume_id: number; cantidad: number }[];
}

/** perfume_id del accesorio → cuántos le tocan al pedido. */
export const empaqueDelPedido = (
  unidades: UnidadPedido[],
  combos: KitCombo[],
  reglas: ReglaEmpaque[],
): Map<number, number> => {
  const total = new Map<number, number>();
  const sumar = (id: number, n: number) => { if (n > 0) total.set(id, (total.get(id) ?? 0) + n); };

  for (const c of combos) for (const k of c.kit) sumar(k.perfume_id, k.cantidad * c.veces);

  for (const u of unidades) {
    const sueltas = u.cantidad - u.enCombo;
    if (!u.linea || sueltas <= 0) continue;
    const talla = u.linea === 'botella_completa' ? null : u.presentacion_id;
    for (const r of reglas) {
      if (r.linea === u.linea && r.presentacion_id === talla) sumar(r.perfume_id, r.cantidad * sueltas);
    }
  }
  return total;
};
