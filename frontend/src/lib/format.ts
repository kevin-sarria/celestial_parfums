import { CURRENCY_OPTIONS } from '../config/constants';

/** Formatea un valor en pesos colombianos sin decimales. */
export const formatPrice = (value: number): string =>
  new Intl.NumberFormat('es-CO', CURRENCY_OPTIONS).format(value);

/** Precio final aplicando el porcentaje de descuento (0-100). */
export const finalPrice = (precio: number, descuento: number): number =>
  descuento > 0 ? Math.round(precio * (1 - descuento / 100)) : precio;
