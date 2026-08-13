import { describe, it, expect } from 'vitest';
import { mlDiluyente, calcularDesgloseCosto, sugerirPrecio, rentabilidadLinea, rentabilidadTotal } from './costeoCotizacion';
import type { EscalaPrecio, FormulaVolumen, Insumo } from '../domain/entities/cotizacion.types';

/**
 * Motor de costeo del mayoreo. De estos números salen los precios que se le
 * pactan a un revendedor por cientos de unidades, así que un error por ml se
 * multiplica por todo el pedido.
 *
 * Las cifras de las pruebas son las RECETAS REALES confirmadas por el dueño
 * (`CLAUDE.md`), no inventadas.
 */

const insumo = (over: Partial<Insumo> & Pick<Insumo, 'id' | 'nombre' | 'precio'>): Insumo => ({
  tipo: 'materia_prima',
  unidad: 'ml',
  alcance: 'unidad',
  activo: true,
  ...over,
} as Insumo);

/** Receta real del 30 ml: esencia 15, sellador 0,40, feromonas 0,30. */
const formula30 = (over: Partial<FormulaVolumen> = {}): FormulaVolumen => ({
  id: 1,
  nombre: '30 ml',
  ml_total: 30,
  esencia_ml: 15,
  sellador_ml: 0.4,
  feromonas_ml: 0.3,
  diluyente_ml: 14.3,
  envase_insumo_id: null,
  envase_nombre: null,
  envase_precio: null,
  esencia_insumo_id: null,
  esencia_nombre: null,
  ...over,
} as FormulaVolumen);

describe('mlDiluyente — el diluyente es SIEMPRE el resto', () => {
  /**
   * No se guarda nunca en la base a propósito: si se guardara, editar el
   * volumen de la receta lo dejaría desincronizado y la suma no daría el frasco.
   */
  it('es lo que queda tras esencia, sellador y feromonas', () => {
    expect(mlDiluyente(formula30())).toBe(14.3);
  });

  it('coincide con las recetas confirmadas de todos los tamaños', () => {
    expect(mlDiluyente({ ml_total: 50, esencia_ml: 25, sellador_ml: 0.5, feromonas_ml: 0.3 })).toBe(24.2);
    expect(mlDiluyente({ ml_total: 75, esencia_ml: 37.5, sellador_ml: 0.8, feromonas_ml: 0.3 })).toBe(36.4);
    expect(mlDiluyente({ ml_total: 100, esencia_ml: 50, sellador_ml: 0.8, feromonas_ml: 0.3 })).toBe(48.9);
    expect(mlDiluyente({ ml_total: 6, esencia_ml: 3, sellador_ml: 0.2, feromonas_ml: 0.15 })).toBe(2.65);
  });

  it('nunca es negativo aunque la receta se pase del volumen', () => {
    expect(mlDiluyente({ ml_total: 30, esencia_ml: 40, sellador_ml: 0, feromonas_ml: 0 })).toBe(0);
  });
});

describe('calcularDesgloseCosto — cuánto cuesta armar UNO', () => {
  const insumos = [
    insumo({ id: 1, nombre: 'Esencia Clasica', precio: 245 }),
    insumo({ id: 2, nombre: 'Diluyente', precio: 20 }),
    insumo({ id: 3, nombre: 'Sellador', precio: 100 }),
    insumo({ id: 4, nombre: 'Feromonas', precio: 100 }),
  ];

  it('suma materias primas por ml más el envase', () => {
    const d = calcularDesgloseCosto(formula30({ envase_precio: 2850 }), insumos);

    expect(d.esencia).toBe(3675);    // 15 × 245
    expect(d.diluyente).toBe(286);   // 14,3 × 20
    expect(d.sellador).toBe(40);     // 0,40 × 100
    expect(d.feromonas).toBe(30);    // 0,30 × 100
    expect(d.envase).toBe(2850);
    expect(d.costo_unitario).toBe(6881);
  });

  it('la esencia DEL PERFUME manda sobre la de la receta', () => {
    /**
     * Cada fragancia tiene su propio costo por ml, y esa es la diferencia entre
     * cotizar bien y cotizar a pérdida: el mismo 30 ml con una esencia de 1.500
     * cuesta el triple que con una de 245.
     */
    const conReceta = calcularDesgloseCosto(formula30({ esencia_precio: 245 } as Partial<FormulaVolumen>), insumos);
    const conPerfume = calcularDesgloseCosto(formula30({ esencia_precio: 245 } as Partial<FormulaVolumen>), insumos, [], 1500);

    expect(conReceta.esencia).toBe(3675);
    expect(conPerfume.esencia).toBe(22500); // 15 × 1.500
  });

  it('cuenta 0 por la materia prima que el admin no ha cargado, sin reventar', () => {
    // Se prefiere mostrar 0 (y que él vea que le falta) antes que romper la
    // pantalla de cotizaciones entera.
    const d = calcularDesgloseCosto(formula30(), []);
    expect(d.esencia).toBe(0);
    expect(d.costo_unitario).toBe(0);
  });

  it('encuentra las materias primas sin importar tildes ni mayúsculas', () => {
    const d = calcularDesgloseCosto(formula30(), [insumo({ id: 1, nombre: 'ESENCIA ÁRABE', precio: 379 })]);
    expect(d.esencia).toBe(5685); // 15 × 379
  });

  it('suma los accesorios marcados para esa línea', () => {
    const d = calcularDesgloseCosto(formula30(), insumos, [
      { insumo_id: 9, nombre: 'Bolsa de organza', precio: 900 },
      { insumo_id: 10, nombre: 'Perfumero', precio: 1500 },
    ]);
    expect(d.accesorios).toBe(2400);
  });
});

describe('sugerirPrecio — el rango de mayoreo se evalúa por LÍNEA', () => {
  const escalas: EscalaPrecio[] = [
    { id: 1, formula_volumen_id: 1, cantidad_min: 1, cantidad_max: 9, precio: 25000 },
    { id: 2, formula_volumen_id: 1, cantidad_min: 10, cantidad_max: 49, precio: 19000 },
    { id: 3, formula_volumen_id: 1, cantidad_min: 50, cantidad_max: null, precio: 15000 },
  ];

  it('elige el rango que cubre esa cantidad', () => {
    expect(sugerirPrecio(escalas, 5)).toBe(25000);
    expect(sugerirPrecio(escalas, 10)).toBe(19000);
    expect(sugerirPrecio(escalas, 49)).toBe(19000);
  });

  it('un tope vacío significa "de aquí en adelante"', () => {
    expect(sugerirPrecio(escalas, 50)).toBe(15000);
    expect(sugerirPrecio(escalas, 100000)).toBe(15000);
  });

  it('ante rangos solapados gana el de mínimo más alto, que es el más específico', () => {
    const solapadas: EscalaPrecio[] = [
      { id: 1, formula_volumen_id: 1, cantidad_min: 1, cantidad_max: 100, precio: 25000 },
      { id: 2, formula_volumen_id: 1, cantidad_min: 50, cantidad_max: 100, precio: 15000 },
    ];
    expect(sugerirPrecio(solapadas, 60)).toBe(15000);
  });

  it('devuelve null si ninguna escala cubre la cantidad: lo pone el admin', () => {
    expect(sugerirPrecio(escalas, 0)).toBeNull();
    expect(sugerirPrecio([], 10)).toBeNull();
  });
});

describe('rentabilidad', () => {
  const desglose = { esencia: 0, diluyente: 0, sellador: 0, feromonas: 0, envase: 0, accesorios: 0, costo_unitario: 10000 };

  it('calcula utilidad y margen de una línea', () => {
    const r = rentabilidadLinea(desglose, 25000, 10);
    expect(r.costoTotal).toBe(100000);
    expect(r.ingresoTotal).toBe(250000);
    expect(r.utilidad).toBe(150000);
    expect(r.margenPct).toBe(60);
  });

  it('avisa en NEGATIVO cuando se vende por debajo del costo', () => {
    // Es el caso real de las premium al mayoreo: hay que verlo, no esconderlo.
    const r = rentabilidadLinea({ ...desglose, costo_unitario: 28106 }, 18000, 1);
    expect(r.utilidad).toBe(-10106);
    expect(r.margenPct).toBeLessThan(0);
  });

  it('el margen es 0 y no infinito cuando no se cobra nada', () => {
    expect(rentabilidadLinea(desglose, 0, 5).margenPct).toBe(0);
  });

  it('el total aplica el descuento global de la cotización', () => {
    const r = rentabilidadTotal(
      [{ desglose_costo: desglose, precio_unitario: 25000, cantidad: 10 }],
      10,
    );
    expect(r.ingresoTotal).toBe(225000);
    expect(r.utilidad).toBe(125000);
  });
});
