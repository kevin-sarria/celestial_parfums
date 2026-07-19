import { randomInt } from 'crypto';

// Sin caracteres ambiguos (0/O, 1/I/L) para dictarlo sin errores por WhatsApp.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código único de descuento legible, ej: CP-7XK2M9. */
export const generarCodigoDescuento = () =>
  'CP-' + Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
