import { describe, expect, it } from 'vitest';
import { cumpleMeta, ganancia, precioSugerido, redondearAMil } from './sugerencia';

describe('el precio sugerido', () => {
  it('30 % es margen sobre el precio: un decant de $10.000 sale a $14.000', () => {
    // 10.000 ÷ 0,70 = 14.285,7 → al mil más cercano
    expect(precioSugerido(10000, { tipo: 'porcentaje', valor: 30 })).toBe(14000);
  });

  it('en pesos: el costo más lo que quiere ganar, redondeado', () => {
    expect(precioSugerido(15800, { tipo: 'pesos', valor: 10000 })).toBe(26000);
  });

  it('redondea al mil MÁS CERCANO (para arriba o para abajo)', () => {
    expect(redondearAMil(14499)).toBe(14000);
    expect(redondearAMil(14500)).toBe(15000);
  });

  it('sin costo, o con una meta sin sentido, no sugiere nada', () => {
    expect(precioSugerido(null, { tipo: 'porcentaje', valor: 30 })).toBeNull();
    expect(precioSugerido(0, { tipo: 'pesos', valor: 5000 })).toBeNull();
    expect(precioSugerido(10000, { tipo: 'porcentaje', valor: 100 })).toBeNull();
  });
});

describe('lo que deja un precio', () => {
  it('en pesos y en % del precio, y si cumple la meta', () => {
    expect(ganancia(14000, 10000)).toEqual({ pesos: 4000, porcentaje: 29 });
    expect(cumpleMeta(14000, 10000, { tipo: 'porcentaje', valor: 30 })).toBe(false);
    expect(cumpleMeta(15000, 10000, { tipo: 'porcentaje', valor: 30 })).toBe(true);
    expect(cumpleMeta(20000, 10000, { tipo: 'pesos', valor: 10000 })).toBe(true);
  });

  it('una talla sin precio no se marca como mala: todavía no tiene precio', () => {
    expect(ganancia(0, 10000)).toBeNull();
    expect(cumpleMeta(0, 10000, { tipo: 'porcentaje', valor: 30 })).toBe(true);
  });
});
