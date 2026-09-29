import type { Combo } from '../../../domain/entities/combo.schema';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { LineaPedido } from './lineasPedido';

/**
 * EL KIT DEL COMBO en la venta (2026-09-28, ola 2 de los regalos): cuando el
 * pedido arma un combo que trae accesorios por defecto, se ofrecen con un
 * botón y entran como REGALO (se descuentan del inventario, no se cobran).
 *
 * Cálculos puros, sin estado: los usa `KitDelCombo.tsx` en Ventas y Créditos.
 */

export interface ItemDelKit { perfume_id: number; nombre: string; cantidad: number }

/**
 * Lo que FALTA agregar del kit de los combos que arma el pedido.
 *
 * - Un combo armado dos veces trae su kit dos veces.
 * - Lo que ya se regaló de ese accesorio en las líneas cuenta como puesto: si
 *   el dueño ya agregó la bolsa a mano como regalo, no se le vuelve a ofrecer.
 * - Solo se sugiere lo que está en el catálogo de Ventas (`porId`). Ese
 *   catálogo incluye lo que no está publicado en la tienda, y está bien: un
 *   perfumero de regalo no tiene por qué venderse al público, y un accesorio
 *   recién creado nace oculto. Lo que ya no existe, no se ofrece.
 */
export const kitPendiente = (
  detectados: { comboId: number; veces: number }[],
  combos: Combo[],
  lineas: LineaPedido[],
  porId: Map<number, Perfume>,
): ItemDelKit[] => {
  const total = new Map<number, ItemDelKit>();
  for (const d of detectados) {
    const combo = combos.find(c => c.id === d.comboId);
    for (const k of combo?.contenido ?? []) {
      if (!porId.has(k.perfume_id)) continue;
      const previo = total.get(k.perfume_id);
      total.set(k.perfume_id, { perfume_id: k.perfume_id, nombre: k.nombre, cantidad: (previo?.cantidad ?? 0) + k.cantidad * d.veces });
    }
  }
  const regaladoDe = (id: number) => lineas.filter(l => l.perfume_id === id).reduce((s, l) => s + l.regalo, 0);
  return [...total.values()]
    .map(k => ({ ...k, cantidad: k.cantidad - regaladoDe(k.perfume_id) }))
    .filter(k => k.cantidad > 0);
};

/**
 * Agrega el kit a las líneas, todo como regalo. Si el accesorio ya tiene una
 * línea (con la misma talla, que en un accesorio es ninguna), la FUSIONA:
 * sube la cantidad y lo regalado en esa misma línea, como el resto de la
 * pantalla. Nunca crea una segunda línea del mismo producto.
 */
export const agregarKit = (lineas: LineaPedido[], kit: ItemDelKit[], porId: Map<number, Perfume>): LineaPedido[] => {
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
        key: `${k.perfume_id}-${presentacion ?? 'sin'}-kit-${Date.now()}`,
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
