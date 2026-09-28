import { describe, expect, it } from 'vitest';
import { repartirPorLineaYFragancia, SIN_IDENTIFICAR, type FichaDeProducto } from './reporteVentasRango.lineas';

const fichas = new Map<number, FichaDeProducto>([
  [1, { nombre: 'Khamrah', linea: 'Contratipo', precio: 60000 }],
  [2, { nombre: 'Aventus', linea: 'Contratipo', precio: 60000 }],
  [3, { nombre: 'Khamrah 1.1', linea: '1.1', precio: 180000 }],
]);
const linea = (perfume_id: number, cantidad = 1, regalo = 0) => ({ perfume_id, cantidad, regalo });

describe('ventas por línea y por fragancia', () => {
  it('una venta de una sola línea va entera a esa línea', () => {
    const r = repartirPorLineaYFragancia([
      { valor: 120000, costo: 40000, pagada: true, lineas: [linea(1), linea(2)] },
    ], fichas);
    expect(r.por_linea).toEqual([
      { linea: 'Contratipo', unidades: 2, vendido: 120000, costo: 40000, ganancia: 80000, margen_pct: 66.7, cobertura_pct: 100 },
    ]);
    expect(r.ventas_repartidas).toBe(0);
  });

  it('una venta mixta se reparte por precio de catálogo: 60.000 + 180.000 → 25 % y 75 %', () => {
    const r = repartirPorLineaYFragancia([
      { valor: 200000, costo: 100000, pagada: true, lineas: [linea(1), linea(3)] },
    ], fichas);
    const de = (l: string) => r.por_linea.find((x) => x.linea === l)!;
    expect(de('1.1').vendido).toBe(150000);
    expect(de('1.1').costo).toBe(75000);
    expect(de('Contratipo').vendido).toBe(50000);
    expect(de('Contratipo').costo).toBe(25000);
    expect(r.ventas_repartidas).toBe(1);
  });

  it('un regalo no trae plata: la venta va a lo cobrado, pero sus unidades sí cuentan', () => {
    const r = repartirPorLineaYFragancia([
      { valor: 60000, costo: 30000, pagada: true, lineas: [linea(1), linea(2, 1, 1)] },
    ], fichas);
    const khamrah = r.por_fragancia.find((f) => f.perfume_id === 1)!;
    const aventus = r.por_fragancia.find((f) => f.perfume_id === 2)!;
    expect(khamrah.vendido).toBe(60000);
    expect(aventus.vendido).toBe(0);
    expect(aventus.unidades).toBe(1);
  });

  it('lo no pagado no cuenta, y lo que no tiene costo es "sin datos", no cero', () => {
    const r = repartirPorLineaYFragancia([
      { valor: 60000, costo: 0, pagada: true, lineas: [linea(1)] },
      { valor: 999999, costo: 1, pagada: false, lineas: [linea(1)] },
    ], fichas);
    expect(r.por_linea[0]).toMatchObject({ vendido: 60000, costo: null, ganancia: null, margen_pct: null, cobertura_pct: 0 });
  });

  it('las ventas viejas sin productos enlazados van a "Sin identificar"', () => {
    const r = repartirPorLineaYFragancia([{ valor: 50000, costo: 0, pagada: true, lineas: [] }], fichas);
    expect(r.por_linea[0].linea).toBe(SIN_IDENTIFICAR);
    expect(r.por_fragancia).toHaveLength(0);
  });

  it('las fragancias van de la que más deja a la que menos; las sin costo, al final', () => {
    const r = repartirPorLineaYFragancia([
      { valor: 60000, costo: 50000, pagada: true, lineas: [linea(1)] }, // deja 10.000
      { valor: 60000, costo: 20000, pagada: true, lineas: [linea(2)] }, // deja 40.000
      { valor: 180000, costo: 0, pagada: true, lineas: [linea(3)] }, // sin costo
    ], fichas);
    expect(r.por_fragancia.map((f) => f.nombre)).toEqual(['Aventus', 'Khamrah', 'Khamrah 1.1']);
  });
});
