import { prisma } from '../config/prisma';
import { mapPerfumePanel, perfumeInclude } from '../repositories/perfume.mapeo';

/**
 * EL PRECIO NORMAL DE UN PEDIDO, calculado por el servidor (2026-10-04).
 *
 * El dueño decidió que su personal no escribe el precio a mano (opción A):
 * la app lo calcula y el servidor lo vuelve a calcular aquí, porque la
 * pantalla se puede saltar. Cualquier cobro por debajo de esto es un
 * descuento y espera la aprobación del dueño (`controlPrecio.ts`).
 *
 * "Normal" = el precio de cada talla con el descuento de la página, y el
 * combo armado solo cuando sale más barato: es lo MÍNIMO que se puede cobrar
 * sin pedir permiso. Los regalos no se descuentan (regalar es un descuento).
 *
 * OJO: la detección de combos es la misma de `frontend/.../useComboDetector.ts`
 * (`detectarCombos`), copiada aquí porque front y back no comparten código.
 * Si cambia la regla del combo, hay que cambiar las dos; la prueba
 * `precioPedido.bd.test.ts` fija los casos para notar si se separan.
 */

const finalPrice = (precio: number, descuento: number) =>
  descuento > 0 ? Math.round(precio * (1 - descuento / 100)) : precio;

interface Unidad { categoria: string; presentacion: string; precio: number; descuento: number; premium: boolean }
interface ComboLite { categoria: string | null; presentacion: string | null; cantidad: number; precio: number; descuento: number }

/** Lo que se ahorra armando combos (misma regla que la tienda y el panel). */
export const ahorroPorCombos = (unidades: Unidad[], combos: ComboLite[]) => {
  const grupos = new Map<string, number[]>();
  for (const u of unidades) {
    // Con descuento propio o esencia premium no entran: los descuentos no se acumulan
    if (u.descuento > 0 || u.premium) continue;
    const k = `${u.categoria}||${u.presentacion}`;
    grupos.set(k, [...(grupos.get(k) ?? []), u.precio]);
  }
  let ahorro = 0;
  for (const [k, precios] of grupos) {
    const [categoria, presentacion] = k.split('||');
    const sueltas = [...precios].sort((a, b) => b - a); // las más caras primero
    const candidatos = combos
      .filter((c) => c.categoria === categoria && (c.presentacion == null || c.presentacion === presentacion) && c.cantidad >= 2)
      .sort((a, b) => b.cantidad - a.cantidad);
    for (const c of candidatos) {
      const precioCombo = finalPrice(c.precio, c.descuento);
      while (sueltas.length >= c.cantidad) {
        const suelto = sueltas.slice(0, c.cantidad).reduce((s, p) => s + p, 0);
        if (precioCombo >= suelto) break;
        sueltas.splice(0, c.cantidad);
        ahorro += suelto - precioCombo;
      }
    }
  }
  return ahorro;
};

export interface LineaPrecio { perfume_id: number; ml?: number | null; cantidad: number }

export const precioNormalDelPedido = async (lineas: LineaPrecio[]) => {
  const ids = [...new Set(lineas.map((l) => l.perfume_id))];
  const [filas, combos] = await Promise.all([
    prisma.perfume.findMany({ where: { id: { in: ids } }, include: perfumeInclude }),
    prisma.combo.findMany({ where: { activo: true }, include: { categoria: true, presentacion: true } }),
  ]);
  const porId = new Map(filas.map((f) => [f.id, mapPerfumePanel(f)]));

  const unidades: Unidad[] = [];
  let subtotal = 0;
  for (const l of lineas) {
    const p = porId.get(l.perfume_id);
    if (!p) continue;
    const talla = l.ml != null ? p.precios.find((t) => t.ml === l.ml) : undefined;
    const precio = finalPrice(talla?.precio ?? p.precio, p.descuento);
    subtotal += precio * l.cantidad;
    for (let i = 0; i < l.cantidad; i++) {
      unidades.push({
        categoria: p.categoria ?? '', presentacion: talla?.presentacion ?? '',
        precio, descuento: p.descuento, premium: p.esencia_premium,
      });
    }
  }
  const ahorro = ahorroPorCombos(unidades, combos.map((c) => ({
    categoria: c.categoria?.nombre ?? null, presentacion: c.presentacion?.nombre ?? null,
    cantidad: c.cantidad, precio: Number(c.precio), descuento: c.descuento,
  })));
  return Math.max(0, subtotal - ahorro);
};
