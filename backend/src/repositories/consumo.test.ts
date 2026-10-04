import { describe, expect, it } from 'vitest';
import { diasQueAlcanza, llegoAlAviso } from './consumo';

describe('cuándo avisar', () => {
  it('por debajo del mínimo, siempre', () => {
    expect(llegoAlAviso({ stock: 5, minimo: 10, consumoDiario: 0 })).toBe(true);
  });

  it('lejos del mínimo, pero alcanza para menos de 2 semanas: avisa', () => {
    expect(llegoAlAviso({ stock: 10, minimo: 2, consumoDiario: 1 })).toBe(true);
    expect(llegoAlAviso({ stock: 20, minimo: 2, consumoDiario: 1 })).toBe(false);
  });

  it('lo que se gasta tan lento que en 2 semanas no llega a una unidad no avisa (un frasco de 1.1)', () => {
    // 1 frasco en 90 días: en 14 días se gastarían 0,16
    expect(llegoAlAviso({ stock: 0, minimo: 0, consumoDiario: 1 / 90 })).toBe(false);
  });

  it('los días que alcanza', () => {
    expect(diasQueAlcanza(10, 1)).toBe(10);
    expect(diasQueAlcanza(10, 0)).toBeNull();
  });
});
