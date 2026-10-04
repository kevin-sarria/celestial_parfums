/**
 * EL PRECIO SUGERIDO DE UNA TALLA (dueño, 2026-10-04).
 *
 * - En porcentaje es MARGEN sobre el precio de venta (opción A del dueño): ganar
 *   30 % es que de cada $100 cobrados, $30 son suyos → costo ÷ (1 − 0,30).
 * - En pesos es lo que quiere ganar por unidad, encima del costo.
 * - Siempre al $1.000 más cercano.
 * - Sin costo no se sugiere: sugerir sobre $0 regalaría el perfume.
 */

export type TipoMeta = 'porcentaje' | 'pesos';
export interface Meta { tipo: TipoMeta; valor: number }

export const redondearAMil = (n: number) => Math.round(n / 1000) * 1000;

export const metaValida = (m: Meta) =>
  m.tipo === 'porcentaje' ? m.valor >= 1 && m.valor <= 90 : m.valor > 0;

export const precioSugerido = (costo: number | null, meta: Meta): number | null => {
  if (costo == null || !(costo > 0) || !metaValida(meta)) return null;
  return redondearAMil(meta.tipo === 'porcentaje' ? costo / (1 - meta.valor / 100) : costo + meta.valor);
};

/** Lo que deja un precio: en pesos y como % del precio. */
export const ganancia = (precio: number, costo: number | null) => {
  if (costo == null || !(precio > 0)) return null;
  const pesos = precio - costo;
  return { pesos, porcentaje: Math.round((pesos / precio) * 100) };
};

/** ¿Este precio cumple la meta? (para pintarlo en rojo si no). */
export const cumpleMeta = (precio: number, costo: number | null, meta: Meta) => {
  const g = ganancia(precio, costo);
  if (!g) return true;
  return meta.tipo === 'porcentaje' ? g.porcentaje >= meta.valor : g.pesos >= meta.valor;
};

/** "30 %" / "$10.000" */
export const textoMeta = (m: Meta, formatPrice: (n: number) => string) =>
  (m.tipo === 'porcentaje' ? `${m.valor} %` : formatPrice(m.valor));
