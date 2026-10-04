import { describe, expect, it } from 'vitest';
import { empaqueDelPedido, type ReglaEmpaque } from './empaqueDelPedido';
import { lineaEmpaqueDe } from './lineaEmpaque';

const BOLSA = 1;
const PERFUMERO = 2;
const P30 = 30;
const P100 = 100;

/** Lo que hoy hace la receta: 30 y 100 ml llevan bolsa y perfumero. */
const reglas: ReglaEmpaque[] = [
  { linea: 'contratipo', presentacion_id: P30, perfume_id: BOLSA, cantidad: 1 },
  { linea: 'contratipo', presentacion_id: P30, perfume_id: PERFUMERO, cantidad: 1 },
  { linea: 'contratipo', presentacion_id: P100, perfume_id: BOLSA, cantidad: 1 },
  { linea: 'contratipo', presentacion_id: P100, perfume_id: PERFUMERO, cantidad: 1 },
  { linea: 'botella_completa', presentacion_id: null, perfume_id: BOLSA, cantidad: 1 },
];

const aObjeto = (m: Map<number, number>) => Object.fromEntries(m);

describe('empaqueDelPedido', () => {
  it('cada unidad suelta lleva el empaque de su línea y talla', () => {
    const r = empaqueDelPedido([{ linea: 'contratipo', presentacion_id: P100, cantidad: 2, enCombo: 0 }], [], reglas);
    expect(aObjeto(r)).toEqual({ [BOLSA]: 2, [PERFUMERO]: 2 });
  });

  it('un 1.1 no lleva nada si su línea no tiene empaque', () => {
    const r = empaqueDelPedido([{ linea: 'uno_uno', presentacion_id: P100, cantidad: 1, enCombo: 0 }], [], reglas);
    expect(r.size).toBe(0);
  });

  it('lo que cae en un combo no lleva su empaque: lleva el kit del combo', () => {
    const r = empaqueDelPedido(
      [{ linea: 'contratipo', presentacion_id: P100, cantidad: 4, enCombo: 3 }],
      [{ comboId: 9, veces: 1, kit: [{ perfume_id: PERFUMERO, cantidad: 1 }] }],
      reglas,
    );
    // 1 suelto (bolsa + perfumero) + el kit del trío (1 perfumero)
    expect(aObjeto(r)).toEqual({ [BOLSA]: 1, [PERFUMERO]: 2 });
  });

  it('un combo armado dos veces trae su kit dos veces', () => {
    const r = empaqueDelPedido(
      [{ linea: 'contratipo', presentacion_id: P30, cantidad: 4, enCombo: 4 }],
      [{ comboId: 9, veces: 2, kit: [{ perfume_id: BOLSA, cantidad: 1 }] }],
      reglas,
    );
    expect(aObjeto(r)).toEqual({ [BOLSA]: 2 });
  });

  it('la botella completa usa la regla que vale para cualquier botella', () => {
    const r = empaqueDelPedido([{ linea: 'botella_completa', presentacion_id: P100, cantidad: 1, enCombo: 0 }], [], reglas);
    expect(aObjeto(r)).toEqual({ [BOLSA]: 1 });
  });

  it('lo que no tiene línea de empaque (un accesorio) no lleva nada', () => {
    expect(empaqueDelPedido([{ linea: null, presentacion_id: null, cantidad: 3, enCombo: 0 }], [], reglas).size).toBe(0);
  });
});

describe('lineaEmpaqueDe', () => {
  it('traduce la línea del producto, y parte el original en decant y botella', () => {
    expect(lineaEmpaqueDe('contratipo', false)).toBe('contratipo');
    expect(lineaEmpaqueDe('1.1', false)).toBe('uno_uno');
    expect(lineaEmpaqueDe('original', false)).toBe('decant');
    expect(lineaEmpaqueDe('original', true)).toBe('botella_completa');
    expect(lineaEmpaqueDe('producto', false)).toBe('producto');
    expect(lineaEmpaqueDe('accesorio', false)).toBeNull();
  });
});
