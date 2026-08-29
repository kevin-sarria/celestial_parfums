import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { consumirPorVenta, revertirVenta } from './inventario.consumoVenta';

/**
 * La venta es la que gasta los insumos: aquí se arma contra pedido, así que de
 * este descuento sale el costo de mercancía vendida y con él la ganancia real
 * del mes. Si descuenta de menos, la ganancia sale inflada y nadie se entera.
 *
 * Reglas en CLAUDE.md → "PASO 3 COMPLETO — LA VENTA CONSUME INVENTARIO" y
 * "PASO 5 — TIPOS DE PRODUCTO".
 */

const FECHA = new Date('2026-08-12');
/** `movimientos_inventario.referencia_id` no tiene llave foránea: basta el número. */
const VENTA = 1234;

const vender = (lineas: { perfume_id: number; ml: number | null; cantidad: number }[], venta = VENTA) =>
  prisma.$transaction((tx) => consumirPorVenta(tx, venta, FECHA, lineas));

describe('venta de un perfume fabricado', () => {
  beforeEach(limpiarBase);

  it('3 unidades de 30 ml descuentan la receta completa multiplicada por tres', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });

    const { costo, sinCostear } = await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 3 }]);

    // La receta confirmada por el dueño: 15 esencia, 0,40 sellador, 0,30
    // feromonas y el diluyente como el RESTO (14,30). Por tres unidades.
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 45);
    expect((await estadoDe(s.diluyente.id)).stock).toBe(1000 - 42.9);
    expect((await estadoDe(s.sellador.id)).stock).toBe(1000 - 1.2);
    expect((await estadoDe(s.feromonas.id)).stock).toBe(1000 - 0.9);
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000 - 3);

    // 15×1500 + 14,3×20 + 0,4×100 + 0,3×100 + 2.850 = 25.706 cada uno
    expect(costo).toBe(77118);
    expect(sinCostear).toEqual([]);
  });

  it('sacar material no mueve el costo promedio de los insumos', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });

    await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 1 }]);

    expect((await estadoDe(s.esencia.id)).promedio).toBe(1500);
    expect((await estadoDe(s.frasco.id)).promedio).toBe(2850);
  });

  it('borrar la venta devuelve al inventario exactamente lo que salió', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 3 }]);

    await prisma.$transaction((tx) => revertirVenta(tx, VENTA));

    for (const insumo of [s.esencia, s.diluyente, s.sellador, s.feromonas, s.frasco]) {
      expect((await estadoDe(insumo.id)).stock).toBe(1000);
    }
    expect(await prisma.movimientoInventario.count({ where: { tipo: 'venta' } })).toBe(0);
  });

  it('si no alcanza el stock la venta PASA igual y el material queda en negativo', async () => {
    // La venta ya ocurrió en la vida real: bloquearla no la deshace, solo impide
    // registrarla. El descuadre queda visible para cuadrarlo con un conteo.
    const s = await sembrarFabricacion30ml({ stock: 10 });

    const { costo } = await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 1 }]);

    expect((await estadoDe(s.esencia.id)).stock).toBe(-5); // tenía 10, gastó 15
    expect(costo).toBeGreaterThan(0);
  });

  it('un perfume sin esencia asignada NO descuenta nada y se reporta', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const huerfano = await prisma.perfume.create({
      data: { nombre: 'Eros', precio: 60000, tipo_producto: 'fabricado' },
    });

    const { costo, sinCostear } = await vender([{ perfume_id: huerfano.id, ml: 30, cantidad: 2 }]);

    // Ni la esencia ni el frasco: se salta la línea ENTERA. Por eso un perfume
    // sin esencia infla la ganancia del mes — su costo entra en cero.
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000);
    expect(costo).toBe(0);
    expect(sinCostear).toEqual(['Eros (sin esencia asignada)']);
  });
});

describe('venta de productos que no se fabrican', () => {
  beforeEach(limpiarBase);

  it('un COMPRADO descuenta una unidad de sí mismo y no necesita talla', async () => {
    // La gorra no tiene ml. Durante un tiempo el código saltaba toda línea sin
    // talla, así que los comprados nunca descontaban.
    const insumo = await crearInsumo('Gorra bordada', { tipo: 'envase', precio: 18000, stock: 20 });
    const gorra = await prisma.perfume.create({
      data: { nombre: 'Gorra', precio: 35000, tipo_producto: 'comprado', insumo_producto_id: insumo.id },
    });

    const { costo } = await vender([{ perfume_id: gorra.id, ml: null, cantidad: 1 }]);

    expect((await estadoDe(insumo.id)).stock).toBe(19);
    expect(costo).toBe(18000);
  });

  it('un FRACCIONADO descuenta los ml del decant de la botella y su envase', async () => {
    const botella = await crearInsumo('Sauvage original 200 ml', { precio: 6316, stock: 95 });
    const envase = await crearInsumo('Frasco decant 10 ml', { tipo: 'envase', precio: 1200, stock: 50 });

    const formula = await prisma.formulaVolumen.create({
      data: { nombre: '10 ml', ml_total: 10, esencia_ml: 10, envase_insumo_id: envase.id },
    });
    await prisma.presentacion.create({ data: { nombre: '10ml', ml: 10, formula_volumen_id: formula.id } });

    const decant = await prisma.perfume.create({
      data: {
        nombre: 'Sauvage decant', precio: 40000,
        tipo_producto: 'fraccionado', insumo_producto_id: botella.id, ml_utiles: 190,
      },
    });

    const { costo } = await vender([{ perfume_id: decant.id, ml: 10, cantidad: 2 }]);

    expect((await estadoDe(botella.id)).stock).toBe(75); // 95 − 2×10
    expect((await estadoDe(envase.id)).stock).toBe(48);
    expect(costo).toBe(2 * (10 * 6316 + 1200));
  });

  it('un fraccionado SIN talla no se puede descontar: no se sabe cuántos ml lleva', async () => {
    const botella = await crearInsumo('Sauvage original 200 ml', { precio: 6316, stock: 95 });
    const decant = await prisma.perfume.create({
      data: { nombre: 'Sauvage decant', precio: 40000, tipo_producto: 'fraccionado', insumo_producto_id: botella.id },
    });

    const { costo, sinCostear } = await vender([{ perfume_id: decant.id, ml: null, cantidad: 1 }]);

    expect((await estadoDe(botella.id)).stock).toBe(95);
    expect(costo).toBe(0);
    expect(sinCostear).toEqual(['Sauvage decant (sin esencia asignada)']);
  });
});

/**
 * LOS 1.1 NO SE FABRICAN AL VENDER (2026-08-29).
 *
 * Es el agujero más caro que salió de auditar la lógica 1.1 con los datos del
 * dueño delante. `consumirPorVenta` no preguntaba si la ficha era 1.1: sin
 * frascos armados, descontaba esencia + envase 1.1 **como si lo hubiera
 * armado**. La tienda lo escondía (un 1.1 sin armar sale "Sin armar"), pero una
 * venta cargada a mano en el dashboard —que es como el dueño registra casi
 * todo— entraba sin que nada lo revisara.
 *
 * Regla decidida por él: **dejar pasar y avisar.** La venta se registra, el
 * frasco queda en negativo, no se toca ni un material, y la respuesta lo dice.
 */
describe('venta de un 1.1 (solo_armado)', () => {
  beforeEach(limpiarBase);

  /** El mismo escenario del 30 ml, pero con la ficha marcada como 1.1. */
  const sembrar11 = async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await prisma.perfume.update({ where: { id: s.perfume.id }, data: { solo_armado: true } });
    return s;
  };

  it('sin frascos armados NO descuenta material y avisa', async () => {
    const s = await sembrar11();

    const { costo, avisos } = await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 1 }]);

    // Ni un ml de esencia, ni un frasco: lo que antes se iba en silencio.
    for (const insumo of [s.esencia, s.diluyente, s.sellador, s.feromonas, s.frasco]) {
      expect((await estadoDe(insumo.id)).stock).toBe(1000);
    }
    expect(costo).toBe(0);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('sin tenerlo armado');
  });

  it('el frasco que no existía queda en −1, no en cero', async () => {
    // Queda a la vista en Inventario → "Frascos ya armados", que sí muestra los
    // negativos: esconderlo sería avisar a nadie.
    const s = await sembrar11();

    await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 1 }]);

    const fila = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(fila.stock)).toBe(-1);
  });

  it('con frascos armados sale de ahí, sin tocar material ni avisar', async () => {
    const s = await sembrar11();
    await prisma.perfumePresentacion.create({
      data: {
        perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        stock: 2, costo_promedio: 40000,
      },
    });

    const { costo, avisos } = await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 2 }]);

    expect(costo).toBe(80000);
    expect(avisos).toEqual([]);
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
  });

  it('si solo alcanza para uno, el otro queda en negativo y no se fabrica', async () => {
    const s = await sembrar11();
    await prisma.perfumePresentacion.create({
      data: {
        perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        stock: 1, costo_promedio: 40000,
      },
    });

    const { avisos } = await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 3 }]);

    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
    const fila = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(fila.stock)).toBe(-2);
    expect(avisos[0]).toContain('2');
  });

  it('un perfume CORRIENTE sin frascos sí se fabrica: la regla es solo de los 1.1', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });

    const { avisos } = await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 1 }]);

    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 15);
    expect(avisos).toEqual([]);
  });

  it('devolver la venta de un 1.1 vuelve a dejar el frasco donde estaba', async () => {
    const s = await sembrar11();
    await vender([{ perfume_id: s.perfume.id, ml: 30, cantidad: 1 }]);

    await prisma.$transaction((tx) => revertirVenta(tx, VENTA));

    const fila = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(fila.stock)).toBe(0);
  });
});
