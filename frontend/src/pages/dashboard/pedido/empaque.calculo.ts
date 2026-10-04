import type { Combo } from '../../../domain/entities/combo.schema';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { detectarCombos } from '../../../application/hooks/useComboDetector';
import { itemsDeLineas, unidadesCobradas, type LineaPedido } from './lineasPedido';

/**
 * EL EMPAQUE DE UN PEDIDO EN EL PANEL (dueño, 2026-10-04).
 *
 * - Lo que cae en un combo lleva el KIT del combo, una vez por cada vez que
 *   se arma, y no el empaque de sus perfumes: el combo manda.
 * - Cada unidad suelta lleva el empaque de su línea y su talla.
 *
 * OJO: `empaqueDelPedido` es copia de `backend/src/empaque/empaqueDelPedido.ts`
 * (front y back no comparten código, igual que `detectarCombos`). El panel la
 * usa para OFRECER el empaque; el servidor, para saber que regalarlo no es un
 * descuento del personal. Las dos tienen las mismas pruebas: si cambia una,
 * cambia la otra.
 */

/** Un accesorio del empaque y cuántos van. */
export interface ItemDelKit { perfume_id: number; nombre: string; cantidad: number }

export type LineaEmpaque = 'contratipo' | 'uno_uno' | 'decant' | 'botella_completa' | 'producto';

export interface ReglaEmpaque {
  linea: LineaEmpaque;
  /** null = vale para cualquier talla (solo `botella_completa`). */
  presentacion_id: number | null;
  perfume_id: number;
  cantidad: number;
}

export interface UnidadPedido {
  linea: LineaEmpaque | null;
  presentacion_id: number | null;
  /** Unidades COBRADAS (lo regalado no arma combo ni lleva empaque). */
  cantidad: number;
  enCombo: number;
}

export interface KitCombo {
  comboId: number;
  veces: number;
  kit: { perfume_id: number; cantidad: number }[];
}

/** La línea del producto, partiendo el original en decant y botella entera. */
export const lineaEmpaqueDe = (linea: Perfume['linea'], botellaCompleta: boolean): LineaEmpaque | null => {
  switch (linea) {
    case 'contratipo': return 'contratipo';
    case '1.1': return 'uno_uno';
    case 'original': return botellaCompleta ? 'botella_completa' : 'decant';
    case 'producto': return 'producto';
    default: return null;
  }
};

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

/**
 * Lo que FALTA agregar del empaque de este pedido.
 *
 * - Lo que ya se regaló de ese accesorio en las líneas cuenta como puesto: si
 *   el dueño ya agregó la bolsa a mano como regalo, no se le vuelve a ofrecer.
 * - Solo se ofrece lo que está en el catálogo de Ventas (`porId`). Ese
 *   catálogo incluye lo que no está publicado en la tienda, y está bien: la
 *   bolsa de regalo no tiene por qué venderse al público. Lo que ya no
 *   existe, no se ofrece.
 */
export const empaquePendiente = (
  lineas: LineaPedido[],
  porId: Map<number, Perfume>,
  combos: Combo[],
  reglas: ReglaEmpaque[],
): ItemDelKit[] => {
  const { detectados, consumidas } = detectarCombos(itemsDeLineas(lineas, porId), combos);
  const unidades: UnidadPedido[] = lineas.map(l => {
    const p = porId.get(l.perfume_id);
    const talla = p?.precios.find(t => t.presentacion === l.presentacion);
    return {
      linea: p ? lineaEmpaqueDe(p.linea, !!talla?.botella_completa) : null,
      presentacion_id: talla?.presentacion_id || null,
      cantidad: unidadesCobradas(l),
      enCombo: consumidas.get(l.key) ?? 0,
    };
  });
  const kits = detectados.map(d => ({
    comboId: d.comboId, veces: d.veces,
    kit: combos.find(c => c.id === d.comboId)?.contenido ?? [],
  }));
  const total = empaqueDelPedido(unidades, kits, reglas);

  const regaladoDe = (id: number) => lineas.filter(l => l.perfume_id === id).reduce((s, l) => s + l.regalo, 0);
  return [...total]
    .filter(([id]) => porId.has(id))
    .map(([id, cantidad]) => ({ perfume_id: id, nombre: porId.get(id)!.nombre, cantidad: cantidad - regaladoDe(id) }))
    .filter(k => k.cantidad > 0);
};

/**
 * Agrega el empaque a las líneas, todo como regalo. Si el accesorio ya tiene una
 * línea (con la misma talla, que en un accesorio es ninguna), la FUSIONA:
 * sube la cantidad y lo regalado en esa misma línea, como el resto de la
 * pantalla. Nunca crea una segunda línea del mismo producto.
 */
export const agregarComoRegalo = (lineas: LineaPedido[], kit: ItemDelKit[], porId: Map<number, Perfume>): LineaPedido[] => {
  let siguientes = [...lineas];
  for (const k of kit) {
    const primera = porId.get(k.perfume_id)?.precios?.[0];
    const presentacion = primera?.presentacion ?? null;
    const i = siguientes.findIndex(l => l.perfume_id === k.perfume_id && l.presentacion === presentacion);
    if (i >= 0) {
      siguientes = siguientes.map((l, j) => (j === i
        ? { ...l, cantidad: l.cantidad + k.cantidad, regalo: l.regalo + k.cantidad }
        : l));
    } else {
      siguientes.push({
        key: `${k.perfume_id}-${presentacion ?? 'sin'}-empaque-${Date.now()}`,
        perfume_id: k.perfume_id,
        nombre: k.nombre,
        presentacion,
        ml: primera?.ml ?? null,
        cantidad: k.cantidad,
        regalo: k.cantidad,
        sin_descuento: false,
      });
    }
  }
  return siguientes;
};
