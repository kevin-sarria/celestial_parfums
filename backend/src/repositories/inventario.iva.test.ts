import { describe, expect, it } from 'vitest';
import { aBase, costosConFlete, desglosarIva } from './inventario.compras';

/**
 * El IVA de las compras y el reparto del flete.
 *
 * No toca base: es aritmética. Pero es de lo más caro que hay si se equivoca,
 * porque el costo promedio ARRASTRA el error compra tras compra y después ya no
 * se puede deshacer.
 *
 * Reglas en CLAUDE.md → "IVA de compras: se configura POR PROVEEDOR".
 */

const TASA = 0.19;

describe('desglosarIva', () => {
  it('con "incluido" el precio YA trae el impuesto: la base se saca dividiendo', () => {
    // Así factura el distribuidor principal. Sumarle el 19% contaría el
    // impuesto dos veces, que es el error que esta función existe para evitar.
    expect(desglosarIva(119000, 'incluido', TASA)).toEqual({ base: 100000, iva: 19000 });
  });

  it('con "agregado" el impuesto se suma sobre lo que dieron', () => {
    expect(desglosarIva(100000, 'agregado', TASA)).toEqual({ base: 100000, iva: 19000 });
  });

  it('con "sin_iva" no se toca nada (Temu, Amazon, persona natural)', () => {
    expect(desglosarIva(100000, 'sin_iva', TASA)).toEqual({ base: 100000, iva: 0 });
  });

  it('una tasa en cero se comporta como si no hubiera impuesto', () => {
    expect(desglosarIva(100000, 'agregado', 0)).toEqual({ base: 100000, iva: 0 });
  });
});

describe('aBase: la unidad en que se factura no es la unidad en que se guarda', () => {
  it('ml y gramos van 1 a 1, como factura el sector', () => {
    expect(aBase(500, 'ml')).toBe(500);
    expect(aBase(500, 'g')).toBe(500);
  });

  it('litros y kilos multiplican por 1000', () => {
    // Sin esto, teclear "20 L" de diluyente entraba como 20 ml y el costo por
    // ml quedaba MIL veces inflado.
    expect(aBase(20, 'l')).toBe(20000);
    expect(aBase(2, 'kg')).toBe(2000);
  });

  it('una unidad desconocida no multiplica (mejor igual que inventado)', () => {
    expect(aBase(7, 'caja')).toBe(7);
  });
});

describe('costosConFlete', () => {
  const mil = [{ cantidad: 1000, subtotal: 322000, unidad_compra: 'ml' }];

  it('sin IVA se comporta como antes de que el impuesto existiera', () => {
    expect(costosConFlete(mil, 0)).toEqual([322]);
  });

  it('el proveedor que SUMA el IVA deja el insumo en $383,18/ml', () => {
    // Caso medido de punta a punta con una factura real de $322.000.
    const iva = { modo: 'agregado' as const, tasa: TASA, descontable: false };
    expect(costosConFlete(mil, 0, iva)).toEqual([383.18]);
  });

  it('el proveedor que lo trae INCLUIDO deja el mismo insumo en $322,00/ml', () => {
    // Misma factura, misma cantidad: la diferencia es solo cómo factura cada uno.
    const iva = { modo: 'incluido' as const, tasa: TASA, descontable: false };
    expect(costosConFlete(mil, 0, iva)).toEqual([322]);
  });

  it('si el IVA se descuenta ante la DIAN, deja de ser costo', () => {
    // Hoy el negocio NO es responsable de IVA, así que el impuesto sale de su
    // bolsillo y SÍ es costo. El día que se constituya, esto cambia el margen.
    const iva = { modo: 'agregado' as const, tasa: TASA, descontable: true };
    expect(costosConFlete(mil, 0, iva)).toEqual([322]);
  });

  it('el flete se reparte proporcional a lo que pesa cada línea', () => {
    const lineas = [
      { cantidad: 100, subtotal: 75000, unidad_compra: 'ml' },
      { cantidad: 100, subtotal: 25000, unidad_compra: 'ml' },
    ];
    // $20.000 de envío: 75% para la primera ($15.000) y 25% para la segunda
    // ($5.000). Cada una sobre sus 100 ml: (75.000+15.000)/100 y (25.000+5.000)/100.
    expect(costosConFlete(lineas, 20000)).toEqual([900, 300]);
  });

  it('el flete se prorratea sobre el valor CON impuesto, que es lo que pesa en la factura', () => {
    const lineas = [
      { cantidad: 100, subtotal: 100000, unidad_compra: 'ml' }, // sube a 119.000
      { cantidad: 100, subtotal: 100000, unidad_compra: 'ml' },
    ];
    const iva = { modo: 'agregado' as const, tasa: TASA, descontable: false };
    // Iguales, así que se reparten mitad y mitad: (119.000 + 5.000) / 100
    expect(costosConFlete(lineas, 10000, iva)).toEqual([1240, 1240]);
  });

  it('el costo se devuelve por unidad BASE: 20 litros son 20.000 ml', () => {
    const lineas = [{ cantidad: 20, subtotal: 400000, unidad_compra: 'l' }];
    expect(costosConFlete(lineas, 0)).toEqual([20]);
  });

  it('una línea sin cantidad no revienta ni reparte flete: da cero', () => {
    const lineas = [{ cantidad: 0, subtotal: 50000, unidad_compra: 'ml' }];
    expect(costosConFlete(lineas, 1000)).toEqual([0]);
  });
});
