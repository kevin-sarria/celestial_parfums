import { describe, expect, it } from 'vitest';
import type { Combo } from '../../../domain/entities/combo.schema';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { agregarKit, kitPendiente } from './kitDelCombo.calculo';
import type { LineaPedido } from './lineasPedido';

const accesorio = (id: number, nombre: string) => ({ id, nombre, precio: 5000, precios: [], es_accesorio: true }) as unknown as Perfume;
const porId = new Map<number, Perfume>([[10, accesorio(10, 'Perfumero')], [11, accesorio(11, 'Bolsa')]]);

const combo = {
  id: 1, nombre: '3 de 30 ml',
  contenido: [
    { perfume_id: 10, nombre: 'Perfumero', cantidad: 1, publicado: true },
    { perfume_id: 11, nombre: 'Bolsa', cantidad: 1, publicado: true },
  ],
} as unknown as Combo;

const linea = (perfume_id: number, cantidad: number, regalo: number): LineaPedido => ({
  key: `k${perfume_id}`, perfume_id, nombre: '', presentacion: null, ml: null, cantidad, regalo, sin_descuento: false,
});

describe('el kit del combo en la venta', () => {
  it('ofrece el kit una vez por cada vez que se arma el combo', () => {
    expect(kitPendiente([{ comboId: 1, veces: 2 }], [combo], [], porId)).toEqual([
      { perfume_id: 10, nombre: 'Perfumero', cantidad: 2 },
      { perfume_id: 11, nombre: 'Bolsa', cantidad: 2 },
    ]);
  });

  it('lo que ya se regaló cuenta como puesto; lo cobrado no', () => {
    const lineas = [linea(10, 1, 1), linea(11, 1, 0)];
    expect(kitPendiente([{ comboId: 1, veces: 1 }], [combo], lineas, porId)).toEqual([
      { perfume_id: 11, nombre: 'Bolsa', cantidad: 1 },
    ]);
  });

  it('ofrece un accesorio oculto de la tienda, pero no uno que ya no está en el catálogo', () => {
    // Un perfumero de regalo no tiene por qué venderse al público: nace oculto
    const kit = { ...combo, contenido: [{ perfume_id: 10, nombre: 'Perfumero', cantidad: 1, publicado: false },
      { perfume_id: 99, nombre: 'Borrado', cantidad: 1, publicado: true }] } as Combo;
    expect(kitPendiente([{ comboId: 1, veces: 1 }], [kit], [], porId)).toEqual([
      { perfume_id: 10, nombre: 'Perfumero', cantidad: 1 },
    ]);
  });

  it('agregar el kit fusiona con una línea que ya estaba: sube cantidad y regalo', () => {
    const r = agregarKit([linea(10, 1, 0)], [{ perfume_id: 10, nombre: 'Perfumero', cantidad: 1 }, { perfume_id: 11, nombre: 'Bolsa', cantidad: 1 }], porId);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ perfume_id: 10, cantidad: 2, regalo: 1 });
    expect(r[1]).toMatchObject({ perfume_id: 11, cantidad: 1, regalo: 1 });
  });
});
