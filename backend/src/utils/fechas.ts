/**
 * Fechas de CALENDARIO ("el 22 de agosto"), que no son lo mismo que instantes.
 *
 * Colombia va en UTC-5 y **no tiene horario de verano**, así que el desfase es
 * fijo. El problema que esto resuelve aparece siempre igual: una columna
 * `@db.Date` (`inicio`, `fin`, `fecha`) la lee Prisma como **medianoche UTC**,
 * y compararla contra `new Date()` —que es un instante— corre el día.
 *
 * Medido en vivo el 2026-08-22: los 4 anuncios del dueño terminaban ese mismo
 * día y llevaban desde las 7:00 p.m. del 21 sin salirle a nadie, porque
 * `fin >= new Date()` era `2026-08-22T00:00Z >= 2026-08-22T00:55Z` → falso. El
 * popup de "¡25% de Bienvenida!" estuvo apagado más de un día.
 *
 * Es el mismo pariente de la regla que ya está en `CLAUDE.md`: nunca
 * `toISOString()` para una fecha de calendario.
 */

/** Colombia siempre UTC-5: sin horario de verano, no hay caso que lo mueva. */
const DESFASE_COLOMBIA_MS = -5 * 60 * 60 * 1000;

/**
 * Qué día es HOY en Colombia, como fecha de calendario a medianoche UTC.
 *
 * Devuelto así a propósito: es exactamente la forma en la que Prisma lee las
 * columnas `@db.Date`, de modo que `fin >= hoyEnColombia()` compara **día
 * contra día** y no instante contra instante. Con eso, "hasta el 22" incluye
 * el 22 entero y la campaña se apaga a la medianoche colombiana del 23.
 *
 * `ahora` se recibe por parámetro para poder probarlo sin tocar el reloj.
 */
export const hoyEnColombia = (ahora: Date = new Date()): Date => {
  const local = new Date(ahora.getTime() + DESFASE_COLOMBIA_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
};
