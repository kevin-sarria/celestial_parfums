import { describe, it, expect } from 'vitest';
import {
  precioLista, precioUnitario, subtotalDeLineas, unidadesDeLineas,
  articulosDeLineas, presentacionResumen, descuentoDeCupon,
  itemsDeLineas, unidadesCobradas,
  type LineaPedido,
} from './lineasPedido';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import { detectarCombos } from '../../../application/hooks/useComboDetector';

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
  regalo: 0,
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

/**
 * El campo "Regalo" de una línea (diseño del 2026-08-18): cuántas de sus
 * unidades van sin cobrar. Reemplaza a la línea-regalo aparte, fija en 1, que
 * no se podía fusionar ni subir.
 */
describe('regalo por línea — qué se cobra', () => {
  const eros = perfume({ id: 1, nombre: 'Eros', precio: 60000 });
  const indiceEros = indice(eros);

  it('sin regalo, se cobran todas las unidades', () => {
    expect(unidadesCobradas(linea({ perfume_id: 1, cantidad: 3 }))).toBe(3);
    expect(subtotalDeLineas([linea({ perfume_id: 1, cantidad: 3 })], indiceEros)).toBe(180000);
  });

  it('con regalo parcial, se cobra solo lo que no es regalo', () => {
    const l = linea({ perfume_id: 1, cantidad: 2, regalo: 1 });
    expect(unidadesCobradas(l)).toBe(1);
    expect(subtotalDeLineas([l], indiceEros)).toBe(60000);
  });

  it('con regalo total, la línea no suma nada al subtotal', () => {
    expect(subtotalDeLineas([linea({ perfume_id: 1, cantidad: 2, regalo: 2 })], indiceEros)).toBe(0);
  });

  it('las unidades siguen contando lo FÍSICO: el inventario descuenta lo regalado también', () => {
    expect(unidadesDeLineas([linea({ perfume_id: 1, cantidad: 2, regalo: 1 })])).toBe(2);
  });
});

describe('regalo por línea — el texto que se guarda', () => {
  const p1 = perfume({ id: 1, nombre: 'Eros' });

  it('marca cuántas van de regalo', () => {
    expect(articulosDeLineas([linea({ perfume_id: 1, cantidad: 2, regalo: 1 })], indice(p1)))
      .toBe('2× Eros (30ML) [1 regalo]');
  });

  it('sin regalo no menciona nada', () => {
    expect(articulosDeLineas([linea({ perfume_id: 1, cantidad: 2 })], indice(p1)))
      .toBe('2× Eros (30ML)');
  });
});

/**
 * DECISIÓN DEL DUEÑO (2026-08-20): lo regalado NO cuenta para armar el precio
 * de combo. Si contara, el mismo frasco se descontaría dos veces —regalado y
 * además abaratando el combo— y el pedido saldría más barato de lo que él
 * quiso regalar. Por eso `itemsDeLineas` reporta las unidades COBRADAS.
 *
 * Se prueba con la detección de combos de verdad, no con un doble: lo que
 * importa aquí es la plata final, no la forma del objeto intermedio.
 */
describe('regalo por línea — no arma combo con lo regalado', () => {
  const contratipo = (id: number, nombre: string) => perfume({
    id, nombre, precio: 60000, categoria: 'Contratipo',
    precios: [{ presentacion: '30ML', ml: 30, precio: 60000, propio: false, presentacion_id: 1 }],
  } as Partial<Perfume> & Pick<Perfume, 'id' | 'nombre'>);

  /** Combo de 3 de 30 ML a $150.000 (sueltos valdrían $180.000). */
  const comboDe3: Combo = {
    id: 1, nombre: '3 de 30 ml', descripcion: null, imagen_url: null,
    categoria_id: 1, categoria: 'Contratipo', presentacion_id: 1, presentacion: '30ML',
    cantidad: 3, precio: 150000, descuento: 0, activo: true,
  };

  const cobro = (lineas: LineaPedido[], porId: Map<number, Perfume>) => {
    const subtotal = subtotalDeLineas(lineas, porId);
    const ahorro = detectarCombos(itemsDeLineas(lineas, porId), [comboDe3]).ahorroTotal;
    return subtotal - ahorro;
  };

  it('3 frascos con 1 regalado: quedan 2 cobrados, no arma combo → $120.000', () => {
    const porId = indice(contratipo(1, 'Eros'), contratipo(2, 'Sauvage'), contratipo(3, 'Bleu'));
    const lineas = [
      linea({ perfume_id: 1, cantidad: 1 }),
      linea({ perfume_id: 2, key: 'k2', cantidad: 1 }),
      linea({ perfume_id: 3, key: 'k3', cantidad: 1, regalo: 1 }),
    ];
    expect(cobro(lineas, porId)).toBe(120000);
  });

  it('"el 4to gratis": 4 frascos con 1 regalado sí arma el combo de 3 → $150.000', () => {
    const porId = indice(contratipo(1, 'Eros'));
    const lineas = [linea({ perfume_id: 1, cantidad: 4, regalo: 1 })];
    expect(cobro(lineas, porId)).toBe(150000);
  });

  it('sin regalos nada cambia: 3 frascos siguen armando el combo → $150.000', () => {
    const porId = indice(contratipo(1, 'Eros'));
    expect(cobro([linea({ perfume_id: 1, cantidad: 3 })], porId)).toBe(150000);
  });
});
