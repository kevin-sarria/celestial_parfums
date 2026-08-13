import { describe, it, expect } from 'vitest';
import { detectarCombos } from './useComboDetector';
import type { CartItem } from '../context/CartContext';
import type { Combo } from '../../domain/entities/combo.schema';

/**
 * Los combos NO son una promoción: son la política de precios por mayoreo del
 * negocio, y se aplican solos. Es el cálculo más difícil de verificar a ojo —
 * agrupa por categoría y talla, arma varias veces, y decide qué unidades cubre.
 *
 * Aquí se prueban las reglas duras de `CLAUDE.md`: el combo solo se cobra si
 * sale MÁS BARATO, los de esencia premium quedan fuera, y los descuentos nunca
 * se acumulan.
 */

const item = (over: Partial<CartItem> & Pick<CartItem, 'id' | 'precio'>): CartItem => ({
  productoId: 1,
  nombre: 'Perfume',
  tipo: 'Contratipo',
  presentacion: '30ML',
  genero: null,
  cantidad: 1,
  descuento: 0,
  imagen_url: null,
  esCombo: false,
  esenciaPremium: false,
  ...over,
});

const combo = (over: Partial<Combo> & Pick<Combo, 'id' | 'cantidad' | 'precio'>): Combo => ({
  nombre: `Combo x${over.cantidad}`,
  categoria: 'Contratipo',
  presentacion: '30ML',
  descuento: 0,
  activo: true,
  ...over,
} as Combo);

describe('detectarCombos — el mayoreo se aplica solo', () => {
  it('arma el combo cuando hay suficientes unidades sueltas', () => {
    const items = [
      item({ id: 'a', precio: 60000 }),
      item({ id: 'b', precio: 60000 }),
      item({ id: 'c', precio: 60000 }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);

    expect(r.detectados).toHaveLength(1);
    expect(r.detectados[0].veces).toBe(1);
    expect(r.detectados[0].unidades).toBe(3);
    expect(r.ahorroTotal).toBe(30000); // 180.000 sueltos − 150.000 de combo
  });

  it('NO lo arma si le falta una unidad', () => {
    const items = [item({ id: 'a', precio: 60000 }), item({ id: 'b', precio: 60000 })];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);
    expect(r.detectados).toHaveLength(0);
  });

  it('lo arma VARIAS veces si alcanza', () => {
    const items = [item({ id: 'a', precio: 60000, cantidad: 6 })];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);
    expect(r.detectados[0].veces).toBe(2);
    expect(r.detectados[0].unidades).toBe(6);
  });

  it('SOLO se aplica si al cliente le sale más barato', () => {
    // Un combo más caro que comprar suelto no puede activarse nunca: sería
    // cobrarle de más a quien lleva más.
    const items = [
      item({ id: 'a', precio: 40000 }),
      item({ id: 'b', precio: 40000 }),
      item({ id: 'c', precio: 40000 }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);
    expect(r.detectados).toHaveLength(0);
    expect(r.ahorroTotal).toBe(0);
  });

  it('el precio del combo respeta SU propio descuento', () => {
    const items = [
      item({ id: 'a', precio: 60000 }),
      item({ id: 'b', precio: 60000 }),
      item({ id: 'c', precio: 60000 }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000, descuento: 10 })]);
    expect(r.detectados[0].precioCombo).toBe(135000);
  });
});

describe('detectarCombos — quién NO entra al combo', () => {
  it('los que ya traen descuento propio: los descuentos jamás se acumulan', () => {
    const items = [
      item({ id: 'a', precio: 54000, descuento: 10 }),
      item({ id: 'b', precio: 60000 }),
      item({ id: 'c', precio: 60000 }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);
    expect(r.detectados).toHaveLength(0);
  });

  it('los de esencia premium: valen mucho más que el resto de su categoría', () => {
    // Colar un premium en un combo por cantidad regalaría la diferencia.
    const items = [
      item({ id: 'a', precio: 60000, esenciaPremium: true }),
      item({ id: 'b', precio: 60000 }),
      item({ id: 'c', precio: 60000 }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);
    expect(r.detectados).toHaveLength(0);
  });

  it('un combo ya armado no se recombina', () => {
    const items = [
      item({ id: 'a', precio: 150000, esCombo: true }),
      item({ id: 'b', precio: 60000 }),
      item({ id: 'c', precio: 60000 }),
      item({ id: 'd', precio: 60000 }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);
    expect(r.detectados[0].unidades).toBe(3); // los tres sueltos, no el combo
  });

  it('no mezcla categorías ni tallas distintas', () => {
    const items = [
      item({ id: 'a', precio: 60000, presentacion: '30ML' }),
      item({ id: 'b', precio: 60000, presentacion: '100ML' }),
      item({ id: 'c', precio: 60000, tipo: 'Original' }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);
    expect(r.detectados).toHaveLength(0);
  });
});

describe('detectarCombos — a qué unidades se aplica', () => {
  it('cubre primero las MÁS CARAS, que es lo que más le ahorra al cliente', () => {
    const items = [
      item({ id: 'barato', precio: 40000 }),
      item({ id: 'caro1', precio: 90000 }),
      item({ id: 'caro2', precio: 90000 }),
      item({ id: 'caro3', precio: 90000 }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);

    expect(r.detectados[0].precioIndividual).toBe(270000); // las tres de 90.000
    expect(r.consumidas.get('barato')).toBeUndefined();    // la barata queda libre
    expect(r.consumidas.get('caro1')).toBe(1);
  });

  it('prueba primero el combo MÁS GRANDE', () => {
    const items = [item({ id: 'a', precio: 60000, cantidad: 5 })];
    const r = detectarCombos(items, [
      combo({ id: 1, cantidad: 3, precio: 150000 }),
      combo({ id: 2, cantidad: 5, precio: 240000 }),
    ]);
    expect(r.detectados[0].comboId).toBe(2);
    expect(r.detectados[0].unidades).toBe(5);
  });
});

describe('detectarCombos — el empujón de venta', () => {
  it('sugiere el combo cuando faltan 1 o 2 unidades', () => {
    const items = [item({ id: 'a', precio: 60000, cantidad: 2 })];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);

    expect(r.sugerencias).toHaveLength(1);
    expect(r.sugerencias[0].faltan).toBe(1);
  });

  it('NO sugiere si faltan demasiadas', () => {
    const items = [item({ id: 'a', precio: 60000 })];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 5, precio: 240000 })]);
    expect(r.sugerencias).toHaveLength(0);
  });

  it('avisa cuando dejó premium afuera, para que el cliente no reclame al pagar', () => {
    const items = [
      item({ id: 'a', precio: 60000, cantidad: 2 }),
      item({ id: 'prem', precio: 90000, esenciaPremium: true }),
    ];
    const r = detectarCombos(items, [combo({ id: 1, cantidad: 3, precio: 150000 })]);

    expect(r.sugerencias[0].faltan).toBe(1);
    expect(r.sugerencias[0].excluyePremium).toBe(true);
  });
});
