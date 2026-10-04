import { describe, expect, it } from 'vitest';
import { quitarCostos } from './ocultarCostos';

describe('esconder costos a quien no puede verlos', () => {
  it('quita costo, ganancia, margen y el costo de la esencia, a cualquier profundidad', () => {
    const r = quitarCostos({
      data: [{ id: 1, valor_venta: 60000, costo_mercancia: 9000, perfumes: [{ insumo_esencia_precio: 400, nombre: 'X' }] }],
      totales: { ganancia_mes: 1, margen_pct: 30, vendido: 5 },
    });
    expect(r).toEqual({ data: [{ id: 1, valor_venta: 60000, perfumes: [{ nombre: 'X' }] }], totales: { vendido: 5 } });
  });

  it('no toca fechas ni valores sueltos', () => {
    const d = new Date('2026-10-04');
    expect(quitarCostos({ dia: d, n: 3 })).toEqual({ dia: d, n: 3 });
  });
});
