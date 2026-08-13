import { describe, it, expect } from 'vitest';
import { finalPrice } from './format';

/**
 * `finalPrice` es el átomo de TODO descuento del sistema: lo usan las tarjetas
 * del catálogo, el carrito, la detección de combos, los cupones y el costeo
 * mayorista. Un error de redondeo aquí cobra mal en todas partes a la vez, y en
 * pesos colombianos no hay centavos donde esconderlo.
 */
describe('finalPrice — precio con descuento aplicado', () => {
  it('sin descuento devuelve el precio intacto', () => {
    expect(finalPrice(60000, 0)).toBe(60000);
  });

  it('aplica el porcentaje', () => {
    expect(finalPrice(60000, 10)).toBe(54000);
    expect(finalPrice(150000, 20)).toBe(120000);
  });

  it('redondea al peso: en COP no existen los centavos', () => {
    // 45000 × 0,67 = 30150 exacto; 45001 × 0,67 = 30150,67 → 30151
    expect(finalPrice(45001, 33)).toBe(30151);
    expect(finalPrice(33333, 15)).toBe(28333); // 28333,05
  });

  it('un descuento del 100% deja el precio en cero', () => {
    expect(finalPrice(60000, 100)).toBe(0);
  });

  it('ignora un descuento negativo en vez de SUBIR el precio', () => {
    // Sin la guarda `descuento > 0`, un -10 cobraría 66.000 por algo de 60.000.
    expect(finalPrice(60000, -10)).toBe(60000);
  });
});
