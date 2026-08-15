import { describe, it, expect } from 'vitest';
import { sinEsenciaParaUno } from './perfume.mapeo';

/**
 * ¿Se quedó un perfume sin esencia para armar ni uno?
 *
 * De esto depende que la tienda lo muestre agotado. El corte NO es "tiene algo
 * de stock": con 3 ml de esencia no sale un frasco de 30 ml, que necesita 15.
 * Si el catálogo lo mostrara disponible, le estaría prometiendo al cliente algo
 * que no se puede armar.
 *
 * Se mide contra la talla MÁS PEQUEÑA de cada perfume, no contra una fija: uno
 * que solo se vende en 100 ml necesita 50 ml de esencia, no los 15 del 30 ml.
 */

/** Talla del catálogo con su receta enlazada (así viaja desde `perfumeInclude`). */
const talla = (ml: number | null, esencia_ml: number | null) => ({
  presentacion: {
    ml,
    formula: esencia_ml == null ? null : { esencia_ml },
  },
});

const fila = (over: {
  stock?: number | null;
  tipo_producto?: string;
  tallas?: ReturnType<typeof talla>[];
  conEsencia?: boolean;
}) => ({
  tipo_producto: over.tipo_producto ?? 'fabricado',
  insumo_esencia: over.conEsencia === false ? null : { stock: over.stock ?? 0 },
  presentaciones: over.tallas ?? [talla(30, 15)],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

describe('sinEsenciaParaUno', () => {
  it('con esencia de sobra, disponible', () => {
    expect(sinEsenciaParaUno(fila({ stock: 100 }))).toBe(false);
  });

  it('se marca cuando no alcanza para UNA unidad', () => {
    // El caso real medido: "212 Men" tiene 10 ml y necesita 15.
    expect(sinEsenciaParaUno(fila({ stock: 10 }))).toBe(true);
  });

  it('justo lo necesario SÍ alcanza', () => {
    expect(sinEsenciaParaUno(fila({ stock: 15 }))).toBe(false);
  });

  it('un pelo por debajo, no', () => {
    // "Pure XS" con 14 ml: no da para el frasco de 30.
    expect(sinEsenciaParaUno(fila({ stock: 14 }))).toBe(true);
  });

  it('se mide contra la talla MÁS PEQUEÑA que ofrece ese perfume', () => {
    const variasTallas = fila({ stock: 20, tallas: [talla(100, 50), talla(30, 15)] });
    expect(sinEsenciaParaUno(variasTallas)).toBe(false); // 20 ≥ 15 del 30 ml

    const soloGrande = fila({ stock: 20, tallas: [talla(100, 50)] });
    expect(sinEsenciaParaUno(soloGrande)).toBe(true); // 20 < 50 del 100 ml
  });

  it('los que NO se fabrican nunca se marcan', () => {
    // Una gorra o un splash comprado no dependen de ninguna esencia.
    expect(sinEsenciaParaUno(fila({ stock: 0, tipo_producto: 'comprado' }))).toBe(false);
    expect(sinEsenciaParaUno(fila({ stock: 0, tipo_producto: 'fraccionado' }))).toBe(false);
  });

  it('un perfume sin esencia asignada cuenta como sin esencia', () => {
    // Nace así al crearse desde una compra: hasta que no se le asigne, no se
    // sabe con qué armarlo.
    expect(sinEsenciaParaUno(fila({ conEsencia: false }))).toBe(true);
  });

  describe('cuando no se puede saber cuánta esencia hace falta', () => {
    it('sin receta enlazada, el corte cae a "que quede algo"', () => {
      // Inventar aquí un número marcaría agotado a quien sí puede vender.
      expect(sinEsenciaParaUno(fila({ stock: 5, tallas: [talla(30, null)] }))).toBe(false);
      expect(sinEsenciaParaUno(fila({ stock: 0, tallas: [talla(30, null)] }))).toBe(true);
    });

    it('lo que no ofrece tallas reales tampoco se puede medir', () => {
      // "Combo Personalizado" y "200/250ML" vienen sin ml a propósito.
      expect(sinEsenciaParaUno(fila({ stock: 5, tallas: [talla(null, null)] }))).toBe(false);
      expect(sinEsenciaParaUno(fila({ stock: 0, tallas: [] }))).toBe(true);
    });
  });
});
