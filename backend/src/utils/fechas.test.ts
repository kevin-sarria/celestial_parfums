import { describe, expect, it } from 'vitest';
import { DIAS_PLAZO_CREDITO, hoyEnColombia, sumarDias } from './fechas';

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

describe('sumarDias: el plazo de un crédito se cuenta en días, no en meses', () => {
  const plazo = (fecha: string) => sumarDias(fecha, DIAS_PLAZO_CREDITO);

  it('el plazo es SIEMPRE el mismo, caiga donde caiga', () => {
    // Es la razón por la que el dueño lo eligió: 30 días son 30 días.
    expect(plazo('2026-08-23')).toBe('2026-09-22');
    expect(plazo('2026-02-28')).toBe('2026-03-30');
    expect(plazo('2026-04-15')).toBe('2026-05-15');
  });

  it('los días 29, 30 y 31 ya no se desbordan', () => {
    // Con `setMonth(+1)`, el 31 de enero vencía el 3 de marzo: 31 días de
    // plazo en vez de uno "de un mes", y el crédito tardaba más en marcarse
    // vencido. Ningún crédito de producción había nacido esos días todavía.
    expect(plazo('2026-01-31')).toBe('2026-03-02');
    expect(plazo('2026-03-31')).toBe('2026-04-30');
    expect(plazo('2026-05-31')).toBe('2026-06-30');
  });

  it('cruza fin de año y año bisiesto sin correrse un día', () => {
    expect(plazo('2026-12-20')).toBe('2027-01-19');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('acepta una fecha con hora pegada y devuelve solo el día', () => {
    expect(sumarDias('2026-08-23T10:30:00.000Z', 1)).toBe('2026-08-24');
  });
});
