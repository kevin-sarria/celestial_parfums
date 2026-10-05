import { describe, expect, it } from 'vitest';
import type { Combo } from '../domain/entities/combo.schema';
import { tramosDeCombo } from './tramosDeCombo';

/**
 * LA MISMA REGLA QUE COBRA EL CARRITO.
 *
 * Los combos son de la categoría "Contratipo" en 30ML: 2 por $42.000, 3 por
 * $60.000 y 4 por $75.000, con el 30ML a $22.000. Si alguien cambia el filtro
 * (categoría, talla o "solo si sale más barato"), la ficha empieza a ofrecer
 * descuentos que el carrito no aplica.
 */
const combo = (over: Partial<Combo> = {}): Combo => ({
  id: 1,
  nombre: 'Duo Express + Obsequio',
  descripcion: null,
  imagen_url: null,
  categoria_id: 2,
  categoria: 'Contratipo',
  presentacion_id: 1,
  presentacion: '30ML',
  cantidad: 2,
  precio: 42000,
  descuento: 0,
  activo: true,
  contenido: [],
  ...over,
});

const losTres = [
  combo({ id: 1, nombre: 'Duo', cantidad: 2, precio: 42000 }),
  combo({ id: 2, nombre: 'Trío', cantidad: 3, precio: 60000 }),
  combo({ id: 3, nombre: 'Pack', cantidad: 4, precio: 75000 }),
];

describe('tramosDeCombo', () => {
  it('calcula el ahorro de cada tramo, del más chico al más grande', () => {
    const t = tramosDeCombo(losTres, 'Contratipo', '30ML', 22000);
    expect(t.map((x) => [x.cantidad, x.precioCombo, x.precioUnidad, x.ahorro])).toEqual([
      [2, 42000, 21000, 2000],
      [3, 60000, 20000, 6000],
      [4, 75000, 18750, 13000],
    ]);
  });

  it('no ofrece un combo que saldría más caro que comprarlos sueltos', () => {
    expect(tramosDeCombo([combo({ cantidad: 2, precio: 50000 })], 'Contratipo', '30ML', 22000)).toEqual([]);
  });

  it('solo aplica a la categoría y a la talla del combo', () => {
    expect(tramosDeCombo([combo()], 'Original', '30ML', 200000)).toEqual([]);
    expect(tramosDeCombo([combo()], 'Contratipo', '100ML', 70000)).toEqual([]);
  });

  it('un combo sin talla (cualquier tamaño) aplica a todas', () => {
    expect(tramosDeCombo([combo({ presentacion: null })], 'Contratipo', '100ML', 70000)).toHaveLength(1);
  });

  it('un combo de 1 perfume no es combo', () => {
    expect(tramosDeCombo([combo({ cantidad: 1, precio: 10000 })], 'Contratipo', '30ML', 22000)).toEqual([]);
  });

  it('sin categoría, o con la talla sin precio, no inventa nada', () => {
    expect(tramosDeCombo([combo()], null, '30ML', 22000)).toEqual([]);
    expect(tramosDeCombo([combo()], 'Contratipo', '30ML', 0)).toEqual([]);
  });

  it('respeta el descuento propio del combo', () => {
    const t = tramosDeCombo([combo({ precio: 44000, descuento: 10 })], 'Contratipo', '30ML', 22000);
    expect(t[0].precioCombo).toBe(39600);
    expect(t[0].ahorro).toBe(4400);
  });
});
