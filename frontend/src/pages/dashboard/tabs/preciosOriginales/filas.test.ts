import { describe, expect, it } from 'vitest';
import { aplicableEnBloque, cambiaConSugerido, filasDePrecios, type Original } from './filas';

const desglose = (total: number) => ({ liquido: total, merma: 0, frasco: 0, empaque: 0, total });
const original = (over: Partial<Original> = {}): Original => ({
  id: 1, nombre: 'Khamrah Original', publicado: true, ml_botella: 100, meta: null,
  tallas: [
    { presentacion_id: 5, nombre: '5ML', ml: 5, botella_completa: false, costo: desglose(10000), precio: 0, propio: false },
    { presentacion_id: 9, nombre: '10ML', ml: 10, botella_completa: false, costo: desglose(20000), precio: 22000, propio: true },
    { presentacion_id: 100, nombre: '100ML', ml: 100, botella_completa: true, costo: desglose(200000), precio: 300000, propio: false },
  ],
  ...over,
});

describe('las filas de la tabla de precios', () => {
  it('una por talla, con su estado según la meta general', () => {
    const f = filasDePrecios([original()], { tipo: 'porcentaje', valor: 30 });
    expect(f.map(x => [x.talla, x.estado, x.sugerido])).toEqual([
      ['Decant 5 ml', 'Sin precio', 14000],
      ['Decant 10 ml', 'Bajo tu meta', 29000],
      ['Botella 100 ml', 'Al día', 286000],
    ]);
  });

  it('la meta propia del perfume manda sobre la general', () => {
    const f = filasDePrecios([original({ meta: { tipo: 'pesos', valor: 2000 } })], { tipo: 'porcentaje', valor: 30 });
    expect(f[1]).toMatchObject({ estado: 'Al día', sugerido: 22000 });
    expect(cambiaConSugerido(f[1])).toBe(false);
  });

  it('sin costo de compra no hay sugerido ni se marca nada como malo', () => {
    const o = original({ tallas: [{ presentacion_id: 5, nombre: '5ML', ml: 5, botella_completa: false, costo: null, precio: 0, propio: false }] });
    expect(filasDePrecios([o], { tipo: 'porcentaje', valor: 30 })[0]).toMatchObject({ estado: 'Sin costo', sugerido: null });
  });
});

describe('el botón en bloque', () => {
  it('pone lo que falta y sube lo que está bajo la meta, pero nunca baja un precio', () => {
    const f = filasDePrecios([original()], { tipo: 'porcentaje', valor: 30 });
    // 5 ml sin precio: sí · 10 ml sube de 22.000 a 29.000: sí · botella bajaría de 300.000 a 286.000: no
    expect(f.map(aplicableEnBloque)).toEqual([true, true, false]);
  });
});
