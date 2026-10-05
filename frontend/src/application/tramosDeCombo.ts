import type { Combo } from '../domain/entities/combo.schema';
import { finalPrice } from '@/lib/format';

export interface TramoCombo {
  comboId: number;
  /** Cuántos perfumes hay que llevar para este tramo. */
  cantidad: number;
  /** Lo que se paga por el combo completo. */
  precioCombo: number;
  /** Lo que sale cada perfume dentro del combo (redondeado). */
  precioUnidad: number;
  /** Cuánto se ahorra frente a comprarlos sueltos a `precioTalla`. */
  ahorro: number;
}

/**
 * Los tramos de combo que le aplican a UNA talla de un perfume.
 *
 * Es la MISMA regla que aplica el carrito (`detectarCombos`): tienen que coincidir
 * la categoría del perfume y su talla con las del combo, y solo se ofrece si de
 * verdad sale más barato que comprarlos sueltos. Sin ese último filtro la ficha
 * estaría prometiendo un descuento que el carrito no cobra.
 */
export const tramosDeCombo = (
  combos: Combo[],
  categoria: string | null,
  presentacion: string,
  precioTalla: number,
): TramoCombo[] => {
  if (!categoria || precioTalla <= 0) return [];
  return combos
    .filter(
      (c) =>
        c.cantidad >= 2 &&
        c.categoria === categoria &&
        (c.presentacion == null || c.presentacion === presentacion),
    )
    .map((c) => {
      const precioCombo = finalPrice(c.precio, c.descuento);
      return {
        comboId: c.id,
        cantidad: c.cantidad,
        precioCombo,
        precioUnidad: Math.round(precioCombo / c.cantidad),
        ahorro: c.cantidad * precioTalla - precioCombo,
      };
    })
    .filter((t) => t.ahorro > 0)
    .sort((a, b) => a.cantidad - b.cantidad);
};
