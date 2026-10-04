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

export interface Unidad {
  categoria: string; presentacion: string; precio: number; descuento: number; premium: boolean;
  /** Índice de la línea del pedido de la que sale (para saber cuántas suyas cayeron en combo). */
  linea?: number;
}
export interface ComboLite {
  id?: number; categoria: string | null; presentacion: string | null; cantidad: number; precio: number; descuento: number;
}

export interface DeteccionServidor {
  ahorro: number;
  /** Índice de línea → unidades suyas que quedaron dentro de un combo. */
  enCombo: Map<number, number>;
  /** Cada combo que se armó y cuántas veces (para su kit). */
  armados: { comboId: number; veces: number }[];
}

/** Qué combos arma el pedido, cuánto se ahorra y qué unidades cubre (misma regla que la tienda y el panel). */
export const detectarCombosServidor = (unidades: Unidad[], combos: ComboLite[]): DeteccionServidor => {
  const grupos = new Map<string, Unidad[]>();
  for (const u of unidades) {
    // Con descuento propio o esencia premium no entran: los descuentos no se acumulan
    if (u.descuento > 0 || u.premium) continue;
    const k = `${u.categoria}||${u.presentacion}`;
    grupos.set(k, [...(grupos.get(k) ?? []), u]);
  }
  let ahorro = 0;
  const enCombo = new Map<number, number>();
  const veces = new Map<number, number>();
  for (const [k, grupo] of grupos) {
    const [categoria, presentacion] = k.split('||');
    const sueltas = [...grupo].sort((a, b) => b.precio - a.precio); // las más caras primero
    const candidatos = combos
      .filter((c) => c.categoria === categoria && (c.presentacion == null || c.presentacion === presentacion) && c.cantidad >= 2)
      .sort((a, b) => b.cantidad - a.cantidad);
    for (const c of candidatos) {
      const precioCombo = finalPrice(c.precio, c.descuento);
      while (sueltas.length >= c.cantidad) {
        const tomadas = sueltas.slice(0, c.cantidad);
        const suelto = tomadas.reduce((s, u) => s + u.precio, 0);
        if (precioCombo >= suelto) break;
        sueltas.splice(0, c.cantidad);
        ahorro += suelto - precioCombo;
        for (const u of tomadas) if (u.linea != null) enCombo.set(u.linea, (enCombo.get(u.linea) ?? 0) + 1);
        if (c.id != null) veces.set(c.id, (veces.get(c.id) ?? 0) + 1);
      }
    }
  }
  return { ahorro, enCombo, armados: [...veces].map(([comboId, n]) => ({ comboId, veces: n })) };
};

/** Lo que se ahorra armando combos. */
export const ahorroPorCombos = (unidades: Unidad[], combos: ComboLite[]) =>
  detectarCombosServidor(unidades, combos).ahorro;

export interface LineaPrecio { perfume_id: number; ml?: number | null; cantidad: number }

/** Los perfumes del pedido (vista del panel) y los combos activos, con su kit. */
export const cargarPedido = async (lineas: { perfume_id: number }[]) => {
  const ids = [...new Set(lineas.map((l) => l.perfume_id))];
  const [filas, combos] = await Promise.all([
    prisma.perfume.findMany({ where: { id: { in: ids } }, include: perfumeInclude }),
    prisma.combo.findMany({ where: { activo: true }, include: { categoria: true, presentacion: true, contenido: true } }),
  ]);
  return {
    porId: new Map(filas.map((f) => [f.id, mapPerfumePanel(f)])),
    combos: combos.map((c) => ({
      id: c.id, categoria: c.categoria?.nombre ?? null, presentacion: c.presentacion?.nombre ?? null,
      cantidad: c.cantidad, precio: Number(c.precio), descuento: c.descuento,
      kit: c.contenido.map((k) => ({ perfume_id: k.perfume_id, cantidad: k.cantidad })),
    })),
  };
};
export type PedidoCargado = Awaited<ReturnType<typeof cargarPedido>>;

/** La talla de una línea y el precio de una unidad suya, con el descuento de la página. */
export const tallaYPrecio = (p: ReturnType<typeof mapPerfumePanel>, ml: number | null | undefined) => {
  const talla = ml != null ? p.precios.find((t) => t.ml === ml) : undefined;
  return { talla, precio: finalPrice(talla?.precio ?? p.precio, p.descuento) };
};

/** Una unidad por cada unidad de cada línea, en el formato de la detección de combos. */
export const unidadesDelPedido = (lineas: LineaPrecio[], { porId }: PedidoCargado) => {
  const unidades: Unidad[] = [];
  lineas.forEach((l, i) => {
    const p = porId.get(l.perfume_id);
    if (!p) return;
    const { talla, precio } = tallaYPrecio(p, l.ml);
    for (let n = 0; n < l.cantidad; n++) {
      unidades.push({
        categoria: p.categoria ?? '', presentacion: talla?.presentacion ?? '',
        precio, descuento: p.descuento, premium: p.esencia_premium, linea: i,
      });
    }
  });
  return unidades;
};

export const precioNormalDelPedido = async (lineas: LineaPrecio[], cargado?: PedidoCargado) => {
  const pedido = cargado ?? await cargarPedido(lineas);
  const unidades = unidadesDelPedido(lineas, pedido);
  const subtotal = unidades.reduce((s, u) => s + u.precio, 0);
  return Math.max(0, subtotal - ahorroPorCombos(unidades, pedido.combos));
};
