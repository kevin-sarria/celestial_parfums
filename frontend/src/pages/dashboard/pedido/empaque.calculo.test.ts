import { describe, expect, it } from 'vitest';
import type { Combo } from '../../../domain/entities/combo.schema';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import {
  agregarComoRegalo, empaqueDelPedido, empaquePendiente, lineaEmpaqueDe, type ReglaEmpaque,
} from './empaque.calculo';
import type { LineaPedido } from './lineasPedido';

/** Los mismos casos que `backend/src/empaque/empaqueDelPedido.test.ts`: son copias. */
const BOLSA = 1;
const PERFUMERO = 2;
const P30 = 30;
const P100 = 100;
const reglas: ReglaEmpaque[] = [
  { linea: 'contratipo', presentacion_id: P30, perfume_id: BOLSA, cantidad: 1 },
  { linea: 'contratipo', presentacion_id: P30, perfume_id: PERFUMERO, cantidad: 1 },
  { linea: 'contratipo', presentacion_id: P100, perfume_id: BOLSA, cantidad: 1 },
  { linea: 'contratipo', presentacion_id: P100, perfume_id: PERFUMERO, cantidad: 1 },
  { linea: 'botella_completa', presentacion_id: null, perfume_id: BOLSA, cantidad: 1 },
];
const aObjeto = (m: Map<number, number>) => Object.fromEntries(m);

describe('empaqueDelPedido (copia del servidor)', () => {
  it('cada unidad suelta lleva el empaque de su línea y talla', () => {
    const r = empaqueDelPedido([{ linea: 'contratipo', presentacion_id: P100, cantidad: 2, enCombo: 0 }], [], reglas);
    expect(aObjeto(r)).toEqual({ [BOLSA]: 2, [PERFUMERO]: 2 });
  });

  it('un 1.1 no lleva nada si su línea no tiene empaque', () => {
    expect(empaqueDelPedido([{ linea: 'uno_uno', presentacion_id: P100, cantidad: 1, enCombo: 0 }], [], reglas).size).toBe(0);
  });

  it('lo que cae en un combo no lleva su empaque: lleva el kit del combo', () => {
    const r = empaqueDelPedido(
      [{ linea: 'contratipo', presentacion_id: P100, cantidad: 4, enCombo: 3 }],
      [{ comboId: 9, veces: 1, kit: [{ perfume_id: PERFUMERO, cantidad: 1 }] }],
      reglas,
    );
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

  it('traduce la línea del producto, y parte el original en decant y botella', () => {
    expect(lineaEmpaqueDe('contratipo', false)).toBe('contratipo');
    expect(lineaEmpaqueDe('1.1', false)).toBe('uno_uno');
    expect(lineaEmpaqueDe('original', false)).toBe('decant');
    expect(lineaEmpaqueDe('original', true)).toBe('botella_completa');
    expect(lineaEmpaqueDe('accesorio', false)).toBeNull();
  });
});

// ── Con el pedido de verdad: líneas, catálogo y combos ─────────────────────
const accesorio = (id: number, nombre: string) =>
  ({ id, nombre, precio: 0, precios: [], es_accesorio: true, linea: 'accesorio' }) as unknown as Perfume;
const contratipo = (id: number) => ({
  id, nombre: `Contratipo ${id}`, precio: 60000, descuento: 0, categoria: 'Árabes', linea: 'contratipo', esencia_premium: false,
  precios: [{ presentacion: '100ML', ml: 100, precio: 60000, presentacion_id: P100, botella_completa: false }],
}) as unknown as Perfume;
const porId = new Map<number, Perfume>([
  [BOLSA, accesorio(BOLSA, 'Bolsa')], [PERFUMERO, accesorio(PERFUMERO, 'Perfumero')],
  [50, contratipo(50)], [51, contratipo(51)],
]);
const linea = (perfume_id: number, cantidad: number, regalo = 0, presentacion: string | null = '100ML'): LineaPedido => ({
  key: `k${perfume_id}`, perfume_id, nombre: '', presentacion, ml: presentacion ? 100 : null, cantidad, regalo, sin_descuento: false,
});
const duo = {
  id: 7, nombre: 'Dúo', activo: true, categoria: 'Árabes', presentacion: '100ML', cantidad: 2, precio: 100000, descuento: 0,
  contenido: [{ perfume_id: PERFUMERO, nombre: 'Perfumero', cantidad: 1, publicado: false }],
} as unknown as Combo;

describe('empaquePendiente', () => {
  it('un contratipo suelto: su bolsa y su perfumero', () => {
    expect(empaquePendiente([linea(50, 1)], porId, [], reglas)).toEqual([
      { perfume_id: BOLSA, nombre: 'Bolsa', cantidad: 1 },
      { perfume_id: PERFUMERO, nombre: 'Perfumero', cantidad: 1 },
    ]);
  });

  it('dos que arman el dúo: solo el kit del dúo', () => {
    expect(empaquePendiente([linea(50, 1), linea(51, 1)], porId, [duo], reglas)).toEqual([
      { perfume_id: PERFUMERO, nombre: 'Perfumero', cantidad: 1 },
    ]);
  });

  it('lo ya regalado cuenta como puesto', () => {
    const lineas = [linea(50, 1), linea(BOLSA, 1, 1, null)];
    expect(empaquePendiente(lineas, porId, [], reglas)).toEqual([
      { perfume_id: PERFUMERO, nombre: 'Perfumero', cantidad: 1 },
    ]);
  });

  it('no ofrece lo que ya no está en el catálogo', () => {
    const sinPerfumero = new Map(porId); sinPerfumero.delete(PERFUMERO);
    expect(empaquePendiente([linea(50, 1)], sinPerfumero, [], reglas)).toEqual([
      { perfume_id: BOLSA, nombre: 'Bolsa', cantidad: 1 },
    ]);
  });
});

describe('agregarComoRegalo', () => {
  it('fusiona con una línea que ya estaba: sube cantidad y regalo', () => {
    const r = agregarComoRegalo([linea(PERFUMERO, 1, 0, null)], [
      { perfume_id: PERFUMERO, nombre: 'Perfumero', cantidad: 1 }, { perfume_id: BOLSA, nombre: 'Bolsa', cantidad: 1 },
    ], porId);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ perfume_id: PERFUMERO, cantidad: 2, regalo: 1 });
    expect(r[1]).toMatchObject({ perfume_id: BOLSA, cantidad: 1, regalo: 1 });
  });
});
