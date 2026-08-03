import { finalPrice } from '@/lib/format';
import type { CartItem } from '../../../application/context/CartContext';
import type { Perfume } from '../../../domain/entities/perfume.schema';

/**
 * Cálculos puros del pedido: precios por talla, con o sin el descuento de la
 * página, y los textos que se guardan. Sin estado y sin peticiones: quien los
 * usa les pasa las líneas y el índice de perfumes por id.
 *
 * Los comparten Ventas y Créditos. Antes cada pantalla tenía su propia versión
 * y cada una hacía bien lo que la otra no; el día que una regla de precios
 * cambiara, había que acordarse de tocar las dos.
 */

/**
 * Una línea del pedido: un producto, en una talla, N veces.
 *
 * Lleva la talla por partida doble a propósito, porque cada mitad sirve para
 * algo distinto y ninguna se deduce de la otra sin adivinar: `presentacion` es
 * la etiqueta del catálogo, con la que se busca el precio; `ml` es el número,
 * con el que el inventario sabe qué receta descontar. Las dos salen juntas de
 * `perfume.precios[]`, así que no se pueden desincronizar.
 */
export interface LineaPedido {
  /** Clave estable para React y para fusionar líneas que quedan iguales. */
  key: string;
  perfume_id: number;
  nombre: string;
  /** Etiqueta del catálogo ("30ML"). Null en lo que no tiene talla (una gorra). */
  presentacion: string | null;
  /** Número de ml. Null en lo que no tiene talla o no es una talla real. */
  ml: number | null;
  cantidad: number;
  /** Quita el descuento de la página en ESTA línea (a crédito no siempre aplica). */
  sin_descuento: boolean;
}

/** Precio de lista de una talla (o el de portada si no está desglosada). */
export const precioLista = (p: Perfume, presentacion: string | null) =>
  (presentacion ? p.precios.find(x => x.presentacion === presentacion)?.precio : undefined) ?? p.precio;

/** Precio unitario de una línea, con o sin el descuento de la página. */
export const precioUnitario = (l: LineaPedido, porId: Map<number, Perfume>) => {
  const p = porId.get(l.perfume_id);
  if (!p) return 0;
  const base = precioLista(p, l.presentacion);
  return l.sin_descuento ? base : finalPrice(base, p.descuento);
};

/** Suma de las líneas, antes de combo y de cupón. */
export const subtotalDeLineas = (lineas: LineaPedido[], porId: Map<number, Perfume>) =>
  lineas.reduce((s, l) => s + precioUnitario(l, porId) * l.cantidad, 0);

/**
 * Unidades totales del pedido. Sustituye al campo "Cantidad" que se tecleaba a
 * mano junto a las líneas: era un dato duplicado que había que cuadrar, y el día
 * que no coincidiera ganaba el número tecleado y se guardaba una mentira.
 */
export const unidadesDeLineas = (lineas: LineaPedido[]) =>
  lineas.reduce((s, l) => s + l.cantidad, 0);

/** Líneas como items de carrito, para reutilizar la detección de combos. */
export const itemsDeLineas = (lineas: LineaPedido[], porId: Map<number, Perfume>): CartItem[] =>
  lineas.map(l => {
    const p = porId.get(l.perfume_id);
    return {
      id: l.key,
      productoId: l.perfume_id,
      nombre: p?.nombre ?? '',
      tipo: p?.categoria ?? '',
      presentacion: l.presentacion ?? '',
      genero: p?.genero ?? null,
      cantidad: l.cantidad,
      precio: precioUnitario(l, porId),
      descuento: l.sin_descuento ? 0 : (p?.descuento ?? 0),
      imagen_url: null,
      esCombo: false,
      esenciaPremium: p?.esencia_premium ?? false,
    };
  });

/** Texto de artículos generado de las líneas ("2× Eros (30ML), Gorra"). */
export const articulosDeLineas = (lineas: LineaPedido[], porId: Map<number, Perfume>) =>
  lineas
    .map(l => {
      const nombre = porId.get(l.perfume_id)?.nombre ?? l.nombre ?? `#${l.perfume_id}`;
      const veces = l.cantidad > 1 ? `${l.cantidad}× ` : '';
      // Lo que no tiene talla no lleva un paréntesis vacío detrás
      return `${veces}${nombre}${l.presentacion ? ` (${l.presentacion})` : ''}`;
    })
    .join(', ');

/** Resumen de las tallas distintas ("30ML, 100ML"). */
export const presentacionResumen = (lineas: LineaPedido[]) =>
  [...new Set(lineas.map(l => l.presentacion).filter(Boolean))].join(', ');

/** Descuento en pesos de un cupón sobre un subtotal (con tope opcional). */
export const descuentoDeCupon = (subtotal: number, pct: number, tope: number) =>
  pct > 0 ? Math.min(Math.round((subtotal * pct) / 100), tope > 0 ? tope : Infinity) : 0;
