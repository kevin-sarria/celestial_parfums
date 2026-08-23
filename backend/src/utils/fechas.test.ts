import { describe, expect, it } from 'vitest';
import { hoyEnColombia } from './fechas';

/** AAAA-MM-DD de una fecha de calendario (ya viene a medianoche UTC). */
const dia = (d: Date) => d.toISOString().slice(0, 10);

describe('hoyEnColombia', () => {
  it('a mediodía en Colombia devuelve ese mismo día', () => {
    // 2026-08-22 12:00 en Colombia = 17:00 UTC
    expect(dia(hoyEnColombia(new Date('2026-08-22T17:00:00Z')))).toBe('2026-08-22');
  });

  it('EL CASO QUE LO MOTIVÓ: a las 7 p.m. de Colombia sigue siendo el mismo día', () => {
    /**
     * Es el instante exacto en que se midió el fallo. Con la versión vieja
     * (`new Date()`) aquí ya era el 23 en UTC, así que un anuncio que terminaba
     * el 22 quedaba fuera de vigencia con el día 22 todavía corriendo.
     */
    expect(dia(hoyEnColombia(new Date('2026-08-23T00:55:00Z')))).toBe('2026-08-22');
  });

  it('un minuto antes de la medianoche colombiana todavía es el día 22', () => {
    // 2026-08-22 23:59 en Colombia = 2026-08-23 04:59 UTC
    expect(dia(hoyEnColombia(new Date('2026-08-23T04:59:00Z')))).toBe('2026-08-22');
  });

  it('a la medianoche colombiana en punto ya es el día 23', () => {
    // 2026-08-23 00:00 en Colombia = 05:00 UTC
    expect(dia(hoyEnColombia(new Date('2026-08-23T05:00:00Z')))).toBe('2026-08-23');
  });

  it('devuelve medianoche UTC, que es como Prisma lee una columna @db.Date', () => {
    const hoy = hoyEnColombia(new Date('2026-08-22T17:00:00Z'));
    expect(hoy.toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });

  it('una campaña "hasta el 22" sigue viva todo el 22 y muere el 23', () => {
    // Así es exactamente como lo compara `whereVigentes()` en anuncio.service
    const fin = new Date('2026-08-22T00:00:00.000Z'); // columna @db.Date = 22 de agosto

    const during = hoyEnColombia(new Date('2026-08-23T04:59:00Z')); // 22, 11:59 p.m. Colombia
    expect(fin >= during).toBe(true);

    const after = hoyEnColombia(new Date('2026-08-23T05:00:00Z')); // 23, 00:00 Colombia
    expect(fin >= after).toBe(false);
  });

  it('cruza bien el fin de mes', () => {
    // 2026-08-31 20:00 Colombia = 2026-09-01 01:00 UTC: en Colombia sigue siendo agosto
    expect(dia(hoyEnColombia(new Date('2026-09-01T01:00:00Z')))).toBe('2026-08-31');
  });
});
