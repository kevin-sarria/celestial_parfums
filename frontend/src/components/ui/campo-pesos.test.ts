import { describe, expect, it } from 'vitest';
import { digitosDePesos, digitosDeValor } from './campo-pesos';

describe('campo de pesos', () => {
  it('"17.000" son diecisiete mil, no diecisiete (2026-10-08)', () => {
    expect(digitosDePesos('17.000')).toBe('17000');
    expect(digitosDePesos('$ 17,000')).toBe('17000');
    expect(digitosDePesos('17000')).toBe('17000');
    expect(digitosDePesos('')).toBe('');
  });

  it('un valor que viene de la base con decimales se redondea, no se lee como miles', () => {
    expect(digitosDeValor('64098.02')).toBe('64098');
    expect(digitosDeValor('22000.00')).toBe('22000');
    expect(digitosDeValor(371.6)).toBe('372');
    expect(digitosDeValor('17000')).toBe('17000');
    expect(digitosDeValor(null)).toBe('');
  });
});
