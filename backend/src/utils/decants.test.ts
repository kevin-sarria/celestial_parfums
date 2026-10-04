import { describe, expect, it } from 'vitest';
import { heredaPrecioGeneral } from './decants';

/**
 * En vivo salían decants de 3 ml de un original al precio de la botella entera
 * ($270.000, 2026-10-03): la talla sin precio caía al general del perfume.
 */
describe('heredaPrecioGeneral', () => {
  it('un perfume que no es original: toda talla hereda el precio general', () => {
    expect(heredaPrecioGeneral('fabricado', 30, null)).toBe(true);
    expect(heredaPrecioGeneral('comprado', 3, 100)).toBe(true);
  });

  it('un original: solo la botella completa lo hereda, los decants no', () => {
    expect(heredaPrecioGeneral('fraccionado', 100, 100)).toBe(true);
    expect(heredaPrecioGeneral('fraccionado', 3, 100)).toBe(false);
    expect(heredaPrecioGeneral('fraccionado', 10, 100)).toBe(false);
  });

  it('un original sin saber cuánto trae la botella: ninguna talla lo hereda', () => {
    expect(heredaPrecioGeneral('fraccionado', 100, null)).toBe(false);
    expect(heredaPrecioGeneral('fraccionado', null, 100)).toBe(false);
  });
});
