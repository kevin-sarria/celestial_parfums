import type { PerfumeRow } from './perfume.mapeo';
import { describe, it, expect } from 'vitest';
import { motivoAgotado, sinExistenciasParaUno } from './perfume.mapeo';

/**
 * ¿Se puede vender HOY una unidad de este perfume?
 *
 * Las tres categorías NO se consiguen igual, así que no se agotan igual
 * (decidido con el dueño el 2026-08-14):
 *
 *   Contratipo → se arma contra pedido  → alcanza la esencia
 *   1.1        → se arma POR ADELANTADO → hay frascos armados
 *   Original   → viene hecho            → hay stock de la botella
 *
 * Y por encima de las tres: **si hay frascos armados, se puede vender**, tenga
 * o no tenga esencia. Es lo que hace vendibles a los 1.1 ya producidos.
 */

/** Talla del catálogo con su receta y sus frascos ya armados. */
const talla = (ml: number | null, esencia_ml: number | null, stock = 0) => ({
  stock,
  presentacion: {
    ml,
    formula: esencia_ml == null ? null : { esencia_ml },
  },
});

const fila = (over: {
  esencia?: number | null;
  tipo_producto?: string;
  solo_armado?: boolean;
  tallas?: ReturnType<typeof talla>[];
  productoStock?: number | null;
}) => ({
  tipo_producto: over.tipo_producto ?? 'fabricado',
  solo_armado: over.solo_armado ?? false,
  insumo_esencia: over.esencia == null ? null : { stock: over.esencia },
  insumo_producto: over.productoStock == null ? null : { stock: over.productoStock },
  presentaciones: over.tallas ?? [talla(30, 15)],
  // Un doble de prueba trae solo los campos que la regla mira; el resto de la
  // fila no influye en el resultado y armarla entera sería ruido.
}) as unknown as PerfumeRow;

describe('sinExistenciasParaUno — contratipo (se arma contra pedido)', () => {
  it('con esencia de sobra, disponible', () => {
    expect(sinExistenciasParaUno(fila({ esencia: 100 }))).toBe(false);
  });

  it('sin esencia para armar ni uno, agotado', () => {
    expect(sinExistenciasParaUno(fila({ esencia: 10 }))).toBe(true);
    expect(motivoAgotado(fila({ esencia: 10 }))).toBe('sin_esencia');
  });
});

describe('sinExistenciasParaUno — frascos ya armados', () => {
  it('con frascos armados se vende AUNQUE no haya esencia', () => {
    // El caso de los 1.1 recién producidos: la esencia ya se gastó al armarlos.
    const armado = fila({ esencia: 0, tallas: [talla(100, 50, 3)] });
    expect(sinExistenciasParaUno(armado)).toBe(false);
    expect(motivoAgotado(armado)).toBe(null);
  });

  it('los frascos armados de CUALQUIER talla lo hacen vendible', () => {
    const dos = fila({ esencia: 0, tallas: [talla(30, 15, 0), talla(100, 50, 2)] });
    expect(sinExistenciasParaUno(dos)).toBe(false);
  });

  it('sin esencia y sin frascos armados, agotado', () => {
    expect(sinExistenciasParaUno(fila({ esencia: 0, tallas: [talla(100, 50, 0)] }))).toBe(true);
  });
});

describe('sinExistenciasParaUno — 1.1 (solo_armado)', () => {
  it('sin frascos armados está agotado, aunque le sobre esencia', () => {
    // Tener el Envase Khamrah 1.1 comprado NO lo pone en la tienda: un 1.1 se
    // ofrece cuando está armado, no cuando se podría armar.
    const sinArmar = fila({ esencia: 500, solo_armado: true, tallas: [talla(100, 50, 0)] });
    expect(sinExistenciasParaUno(sinArmar)).toBe(true);
    expect(motivoAgotado(sinArmar)).toBe('sin_armados');
  });

  it('con frascos armados, disponible', () => {
    const armado = fila({ esencia: 0, solo_armado: true, tallas: [talla(100, 50, 1)] });
    expect(sinExistenciasParaUno(armado)).toBe(false);
  });
});

describe('sinExistenciasParaUno — original (comprado)', () => {
  it('sin stock de su botella, agotado', () => {
    // Hoy un comprado NUNCA se agotaba solo: se podía vender lo que no se tiene.
    const vacio = fila({ tipo_producto: 'comprado', productoStock: 0 });
    expect(sinExistenciasParaUno(vacio)).toBe(true);
    expect(motivoAgotado(vacio)).toBe('sin_producto');
  });

  it('con stock de su botella, disponible aunque no tenga esencia', () => {
    expect(sinExistenciasParaUno(fila({ tipo_producto: 'comprado', productoStock: 2 }))).toBe(false);
  });

  it('sin insumo asignado no se puede saber, y no se marca', () => {
    // Nace así al crearse la ficha. Inventar aquí un "agotado" escondería de la
    // tienda productos que sí se tienen.
    expect(sinExistenciasParaUno(fila({ tipo_producto: 'comprado' }))).toBe(false);
  });

  it('un fraccionado no se juzga por ahora', () => {
    // La botella de la que salen los decants se gasta por ml, no por unidades:
    // el corte pide la merma de fraccionamiento, que el dueño aún no definió.
    expect(sinExistenciasParaUno(fila({ tipo_producto: 'fraccionado', productoStock: 0 }))).toBe(false);
  });
});
