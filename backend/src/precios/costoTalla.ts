import { esBotellaCompleta, mlQueSalenDeLaBotella } from '../utils/decants';

/**
 * LO QUE CUESTA UNA TALLA DE UN ORIGINAL, desglosado (2026-10-04).
 *
 * Es la misma cuenta que descuenta la venta (`inventario.consumoVenta.ts`):
 * del líquido sale el decant MÁS lo que se pierde al trasvasar; un decant
 * lleva su frasco; la botella completa sale cerrada, sin merma ni frasco. Se
 * suma el empaque que le toca a esa talla. Sin el costo de la botella no hay
 * costo: sugerir precio sobre un costo de $0 regalaría el perfume.
 */
export interface Desglose { liquido: number; merma: number; frasco: number; empaque: number; total: number }

export const costoDeTalla = ({ ml, mlBotella, costoMl, frasco, empaque }: {
  ml: number;
  mlBotella: number | null;
  /** Costo de un ml de la botella. */
  costoMl: number;
  /** Costo del frasco del decant (se ignora en la botella completa). */
  frasco: number;
  empaque: number;
}): Desglose | null => {
  if (!(costoMl > 0)) return null;
  const entera = esBotellaCompleta(ml, mlBotella);
  const liquido = Math.round(ml * costoMl);
  const merma = Math.round((mlQueSalenDeLaBotella(ml, mlBotella) - ml) * costoMl);
  const frascoReal = entera ? 0 : Math.round(frasco);
  const empaqueReal = Math.round(empaque);
  return { liquido, merma, frasco: frascoReal, empaque: empaqueReal, total: liquido + merma + frascoReal + empaqueReal };
};
