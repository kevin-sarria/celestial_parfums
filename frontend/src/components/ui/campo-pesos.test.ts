import { describe, expect, it } from 'vitest';
import { digitosDePesos } from './campo-pesos';

describe('campo de pesos', () => {
  it('"17.000" son diecisiete mil, no diecisiete (2026-10-08)', () => {
    expect(digitosDePesos('17.000')).toBe('17000');
    expect(digitosDePesos('$ 17,000')).toBe('17000');
    expect(digitosDePesos('17000')).toBe('17000');
    expect(digitosDePesos('')).toBe('');
  });
});
