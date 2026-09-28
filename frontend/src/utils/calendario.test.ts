import { describe, expect, it } from 'vitest';
import { dentroDe, fechaLegible, leerFecha, mesLegible, moverDias, moverMeses, semanasDelMes } from './calendario';

describe('calendario', () => {
  it('lee fechas válidas y rechaza las que no existen', () => {
    expect(leerFecha('2026-09-28')).toEqual({ anio: 2026, mes: 9, dia: 28 });
    expect(leerFecha('2026-02-31')).toBeNull();
    expect(leerFecha('')).toBeNull();
  });

  it('mueve días cruzando mes y año', () => {
    expect(moverDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(moverDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('mueve meses sin desbordarse en fin de mes', () => {
    expect(moverMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(moverMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(moverMeses('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('la cuadrícula empieza en lunes y tiene 6 semanas', () => {
    // El 1 de septiembre de 2026 es martes: la primera casilla es el lunes 31 de agosto
    const s = semanasDelMes(2026, 9);
    expect(s).toHaveLength(6);
    expect(s[0][0]).toBe('2026-08-31');
    expect(s[0][1]).toBe('2026-09-01');
  });

  it('respeta mínimo y máximo', () => {
    expect(dentroDe('2026-09-28', '2026-09-01', '2026-09-30')).toBe(true);
    expect(dentroDe('2026-10-01', undefined, '2026-09-30')).toBe(false);
  });

  it('se lee sin correrse un día (Colombia va en UTC-5)', () => {
    expect(fechaLegible('2026-09-01')).toBe('1 sep 2026');
    expect(mesLegible(2026, 9)).toBe('Septiembre 2026');
  });
});
