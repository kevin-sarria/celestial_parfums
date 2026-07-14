/** Utilidades de color para superficies personalizables (página Contáctame). */

const INK = '#2f2a3d';
const WHITE = '#ffffff';

/**
 * Devuelve el color de texto (tinta o blanco) con mejor contraste
 * sobre un fondo hexadecimal dado. Ante un valor inválido asume fondo claro.
 */
export function readableTextOn(hex: string): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return INK;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Luminancia percibida (fórmula clásica ITU-R BT.601)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? INK : WHITE;
}
