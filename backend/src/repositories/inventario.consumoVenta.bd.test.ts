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
