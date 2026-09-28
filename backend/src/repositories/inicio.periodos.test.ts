import { describe, expect, it } from 'vitest';
import { periodosComparables } from './inicio.repository';

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const texto = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Inicio compara el mes en curso con el anterior HASTA EL MISMO DÍA: el 28 de
 * septiembre contra agosto entero haría parecer que siempre se va peor.
 */
describe('periodos de Inicio', () => {
  it('el 28 de septiembre se compara con el 1–28 de agosto', () => {
    const p = periodosComparables(dia('2026-09-28'));
    expect(texto(p.desde)).toBe('2026-09-01');
    expect(texto(p.hasta)).toBe('2026-09-28');
    expect(texto(p.desdeAnterior)).toBe('2026-08-01');
    expect(texto(p.hastaAnterior)).toBe('2026-08-28');
  });

  it('el 31 de marzo se corta en el último día de febrero', () => {
    const p = periodosComparables(dia('2026-03-31'));
    expect(texto(p.hastaAnterior)).toBe('2026-02-28');
  });

  it('en enero, el anterior es diciembre del año pasado', () => {
    const p = periodosComparables(dia('2027-01-15'));
    expect(texto(p.desdeAnterior)).toBe('2026-12-01');
    expect(texto(p.hastaAnterior)).toBe('2026-12-15');
  });
});
