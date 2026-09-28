import { describe, expect, it } from 'vitest';
import { calcularRecompra, mediana, type Compra } from './recompra.calculo';

const compra = (clave: string, dia: string, referencia = 'Khamrah 30ml'): Compra => ({ clave, nombre: clave, dia, referencia });

describe('lista de recompra', () => {
  it('el ritmo de cada cliente es la mediana de SUS días entre compras', () => {
    // 20 y 30 días → mediana 25; la última fue el 1-sep → le toca el 26-sep
    const r = calcularRecompra([
      compra('ana', '2026-07-13'), compra('ana', '2026-08-02'), compra('ana', '2026-09-01'),
    ], '2026-09-28');
    const ana = r.clientes[0];
    expect(ana.ritmo_dias).toBe(25);
    expect(ana.ritmo_propio).toBe(true);
    expect(ana.proxima).toBe('2026-09-26');
    expect(ana.dias_para).toBe(-2);
    expect(ana.estado).toBe('le_toca');
  });

  it('quien compró una vez usa el punto medio de los que repiten', () => {
    const r = calcularRecompra([
      compra('ana', '2026-08-01'), compra('ana', '2026-08-21'), // 20
      compra('beto', '2026-08-01'), compra('beto', '2026-08-31'), // 30
      compra('caro', '2026-09-20'), // una sola vez
    ], '2026-09-28');
    expect(r.punto_medio_dias).toBe(25);
    const caro = r.clientes.find((c) => c.clave === 'caro')!;
    expect(caro.ritmo_propio).toBe(false);
    expect(caro.proxima).toBe('2026-10-15');
    expect(caro.estado).toBe('al_dia');
  });

  it('dos ventas el mismo día son una sola compra', () => {
    const r = calcularRecompra([compra('ana', '2026-09-01'), compra('ana', '2026-09-01')], '2026-09-02');
    expect(r.clientes[0].compras).toBe(1);
  });

  it('pronto, le toca y dormido, en ese orden de urgencia', () => {
    const r = calcularRecompra([
      compra('pronto', '2026-08-01'), compra('pronto', '2026-09-01'), // cada 31 → 2-oct, faltan 4
      compra('dormido', '2026-05-01'), compra('dormido', '2026-05-11'), // cada 10 → 21-may, hace 130 días
      compra('toca', '2026-09-10'), compra('toca', '2026-09-20'), // cada 10 → 30-sep... faltan 2 → pronto
      compra('ya', '2026-09-01'), compra('ya', '2026-09-11'), // cada 10 → 21-sep, hace 7 → le toca
    ], '2026-09-28');
    expect(Object.fromEntries(r.clientes.map((c) => [c.clave, c.estado]))).toEqual({
      pronto: 'pronto', dormido: 'dormido', toca: 'pronto', ya: 'le_toca',
    });
    expect(r.clientes[0].clave).toBe('ya');
    expect(r.resumen).toEqual({ le_toca: 1, pronto: 2, dormido: 1, al_dia: 0 });
  });

  it('mediana', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 10])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
});
