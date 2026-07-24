import { finalPrice } from '@/lib/format';
import type { CartItem } from '../../application/context/CartContext';
import type { Perfume } from '../../domain/entities/perfume.schema';
import type { LineaCredito } from './types';

/**
 * Cálculos puros del editor de líneas de un crédito: precios por talla, con o
 * sin el descuento de la página, y el texto/resumen que se guarda. Sin estado:
 * el componente les pasa las líneas y el índice de perfumes por id.
 */

/** Precio de lista de una talla (o el de portada si no está desglosada). */
export const precioLista = (p: Perfume, presentacion: string) =>
  p.precios.find(x => x.presentacion === presentacion)?.precio ?? p.precio;

/** Precio unitario de una línea, con o sin el descuento de la página. */
export const precioUnitario = (l: LineaCredito, porId: Map<number, Perfume>) => {
  const p = porId.get(l.perfume_id);
  if (!p) return 0;
  const base = precioLista(p, l.presentacion);
  return l.sin_descuento ? base : finalPrice(base, p.descuento);
};

/** Líneas como items de carrito, para reutilizar la detección de combos. */
export const itemsDeLineas = (lineas: LineaCredito[], porId: Map<number, Perfume>): CartItem[] =>
  lineas.map(l => {
    const p = porId.get(l.perfume_id);
    return {
      id: l.key,
      productoId: l.perfume_id,
      nombre: p?.nombre ?? '',
      tipo: p?.categoria ?? '',
      presentacion: l.presentacion,
      genero: p?.genero ?? null,
      cantidad: l.cantidad,
      precio: precioUnitario(l, porId),
      descuento: l.sin_descuento ? 0 : (p?.descuento ?? 0),
      imagen_url: null,
      esCombo: false,
      esenciaPremium: p?.esencia_premium ?? false,
    };
  });

/** Texto de artículos generado de las líneas ("2× Eros (30ml), Sauvage (60ml)"). */
export const articulosDeLineas = (lineas: LineaCredito[], porId: Map<number, Perfume>) =>
  lineas
    .map(l => {
      const nombre = porId.get(l.perfume_id)?.nombre ?? `#${l.perfume_id}`;
      return `${l.cantidad > 1 ? `${l.cantidad}× ` : ''}${nombre} (${l.presentacion})`;
    })
    .join(', ');

/** Resumen de presentaciones distintas ("30ml, 60ml"). */
export const presentacionResumen = (lineas: LineaCredito[]) =>
  [...new Set(lineas.map(l => l.presentacion))].join(', ');

/** Descuento en pesos de un cupón sobre un subtotal (con tope opcional). */
export const descuentoDeCupon = (subtotal: number, pct: number, tope: number) =>
  pct > 0 ? Math.min(Math.round((subtotal * pct) / 100), tope > 0 ? tope : Infinity) : 0;
