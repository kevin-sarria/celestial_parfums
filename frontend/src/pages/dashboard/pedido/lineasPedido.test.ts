import { describe, it, expect } from 'vitest';
import {
  precioLista, precioUnitario, subtotalDeLineas, unidadesDeLineas,
  articulosDeLineas, presentacionResumen, descuentoDeCupon,
  type LineaPedido,
} from './lineasPedido';
import type { Perfume } from '../../../domain/entities/perfume.schema';

/**
 * Cálculos compartidos por Ventas y Créditos. Antes cada pantalla tenía su
 * propia versión y cada una hacía bien lo que la otra no.
 *
 * Aquí se prueba la cascada de precios (el precio NO vive en el perfume) y el
 * cupón con su tope, que es lo que impide que una campaña regale más de lo
 * presupuestado.
 */

const perfume = (over: Partial<Perfume> & Pick<Perfume, 'id' | 'nombre'>): Perfume => ({
  precio: 60000,
  precios: [],
  descuento: 0,
  categoria: 'Contratipo',
  genero: null,
  esencia_premium: false,
  ...over,
} as Perfume);

const linea = (over: Partial<LineaPedido> & Pick<LineaPedido, 'perfume_id'>): LineaPedido => ({
  key: `k${over.perfume_id}`,
  nombre: 'Perfume',
  presentacion: '30ML',
  ml: 30,
  cantidad: 1,
  sin_descuento: false,
  ...over,
});

const indice = (...ps: Perfume[]) => new Map(ps.map((p) => [p.id, p]));

describe('precioLista — el precio sale de la talla, no del perfume', () => {
  const eros = perfume({
    id: 1, nombre: 'Eros', precio: 60000,
    precios: [
      { presentacion: '30ML', ml: 30, precio: 60000, propio: false, presentacion_id: 1 },
      { presentacion: '100ML', ml: 100, precio: 150000, propio: false, presentacion_id: 3 },
    ],
  } as Partial<Perfume> & Pick<Perfume, 'id' | 'nombre'>);

  it('usa el precio de la talla pedida', () => {
    expect(precioLista(eros, '100ML')).toBe(150000);
  });

  it('cae al precio de portada si la talla no está desglosada', () => {
    expect(precioLista(eros, '50ML')).toBe(60000);
  });

  it('cae al precio de portada en lo que no tiene talla (una gorra)', () => {
    expect(precioLista(perfume({ id: 2, nombre: 'Gorra', precio: 18000 }), null)).toBe(18000);
  });
});

describe('precioUnitario — con y sin el descuento de la página', () => {
  const conDescuento = perfume({ id: 1, nombre: 'Eros', precio: 60000, descuento: 10 });

  it('aplica el descuento del perfume', () => {
    expect(precioUnitario(linea({ perfume_id: 1 }), indice(conDescuento))).toBe(54000);
  });

  it('la casilla "sin −X%" lo quita para ESA línea', () => {
    // A crédito no siempre aplica lo del contado, y se decide línea por línea.
    expect(precioUnitario(linea({ perfume_id: 1, sin_descuento: true }), indice(conDescuento))).toBe(60000);
  });

  it('un producto que ya no está en el índice vale 0, no rompe el formulario', () => {
    expect(precioUnitario(linea({ perfume_id: 99 }), indice(conDescuento))).toBe(0);
  });
});

describe('subtotalDeLineas y unidadesDeLineas', () => {
  const p1 = perfume({ id: 1, nombre: 'Eros', precio: 60000 });
  const p2 = perfume({ id: 2, nombre: 'Sauvage', precio: 50000 });

  it('multiplica por la cantidad de cada línea', () => {
    const lineas = [linea({ perfume_id: 1, cantidad: 2 }), linea({ perfume_id: 2, cantidad: 1 })];
    expect(subtotalDeLineas(lineas, indice(p1, p2))).toBe(170000);
  });

  it('las unidades se DERIVAN de las líneas', () => {
    /**
     * Sustituyeron al campo "Cantidad" que se tecleaba a mano: era un dato
     * duplicado y el día que no coincidiera ganaba el número tecleado, o sea
     * que se guardaba una mentira.
     */
    expect(unidadesDeLineas([linea({ perfume_id: 1, cantidad: 3 }), linea({ perfume_id: 2, cantidad: 2 })])).toBe(5);
  });

  it('un pedido vacío suma cero', () => {
    expect(subtotalDeLineas([], indice(p1))).toBe(0);
    expect(unidadesDeLineas([])).toBe(0);
  });
});

describe('textos que se guardan en la venta', () => {
  const p1 = perfume({ id: 1, nombre: 'Eros' });
  const p2 = perfume({ id: 2, nombre: 'Gorra' });

  it('escribe las unidades con "2×" y la talla entre paréntesis', () => {
    const lineas = [linea({ perfume_id: 1, cantidad: 2 }), linea({ perfume_id: 2, presentacion: null, ml: null })];
    expect(articulosDeLineas(lineas, indice(p1, p2))).toBe('2× Eros (30ML), Gorra');
  });

  it('resume las tallas distintas, sin repetirlas', () => {
    const lineas = [
      linea({ perfume_id: 1, presentacion: '30ML' }),
      linea({ perfume_id: 2, presentacion: '100ML' }),
      linea({ perfume_id: 1, key: 'otra', presentacion: '30ML' }),
    ];
    expect(presentacionResumen(lineas)).toBe('30ML, 100ML');
  });

  it('lo que no tiene talla no deja un paréntesis vacío', () => {
    expect(presentacionResumen([linea({ perfume_id: 2, presentacion: null })])).toBe('');
  });
});

describe('descuentoDeCupon — el tope protege el presupuesto de la campaña', () => {
  it('descuenta el porcentaje sobre el subtotal', () => {
    expect(descuentoDeCupon(100000, 20, 0)).toBe(20000);
  });

  it('nunca pasa del tope en pesos de la campaña', () => {
    // 20% de 500.000 serían 100.000, pero la campaña topó en 30.000.
    expect(descuentoDeCupon(500000, 20, 30000)).toBe(30000);
  });

  it('tope en 0 significa SIN tope, no "no descuentes"', () => {
    expect(descuentoDeCupon(500000, 20, 0)).toBe(100000);
  });

  it('sin porcentaje no hay descuento', () => {
    expect(descuentoDeCupon(100000, 0, 50000)).toBe(0);
  });

  it('redondea al peso', () => {
    expect(descuentoDeCupon(33333, 15, 0)).toBe(5000); // 4999,95
  });
});
