import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, estadoDe, limpiarBase } from '../test/baseDePrueba';
import { aplicarMovimiento } from './inventario.repository';
import { fusionarInsumos } from './fusionarInsumos.repository';
import { contarUsos } from './insumo.usos';

/**
 * FUSIONAR DOS REGISTROS DEL MISMO MATERIAL.
 *
 * El dueño tiene dos fichas del mismo perfumero físico, las dos con historia, y
 * no puede borrar ninguna: `eliminarInsumo` las retiene con razón —borrar se
 * lleva por delante los movimientos, que están en cascada—. Apagar la vieja
 * esconde el problema y parte el historial en dos para siempre.
 *
 * Lo que hace posible arreglarlo sin descuadrar nada: **`stock` es una columna
 * guardada, no una suma del libro**. Mover la etiqueta `insumo_id` de un
 * movimiento viejo re-etiqueta la historia; no la vuelve a ejecutar. Por eso la
 * primera prueba de este archivo —la que de verdad importa— es que el stock del
 * registro que sobrevive no se mueve ni un gramo.
 *
 * Diseño completo en `docs/superpowers/specs/2026-08-29-fusionar-materiales-design.md`.
 */

const FECHA = new Date('2026-08-29');

/**
 * Los dos perfumeros del caso real, con la historia repartida entre ambos.
 *
 * `origen` es el registro viejo (accesorio, con 3 salidas y sin una sola
 * compra); `destino` es el bueno (envase, con las 30 unidades contadas a mano).
 */
const sembrarDuplicados = async () => {
  const origen = await crearInsumo('Perfumero Recargable', { tipo: 'accesorio', precio: 1050 });
  const destino = await crearInsumo('Perfumero recargable 6 ml', {
    tipo: 'envase', precio: 2100, stock: 30,
  });

  // Tres salidas viejas colgadas del registro equivocado.
  for (const referencia_id of [101, 102, 103]) {
    await prisma.$transaction((tx) => aplicarMovimiento(tx, {
      insumo_id: origen.id,
      tipo: 'venta',
      cantidad: -1,
      fecha: FECHA,
      referencia_id,
      nota: `Venta #${referencia_id}`,
    }));
  }

  return { origen, destino };
};

describe('fusionar dos registros del mismo material', () => {
  beforeEach(limpiarBase);

  it('NO toca el stock del registro que sobrevive', async () => {
    const { origen, destino } = await sembrarDuplicados();
    // El viejo quedó en −3 y el bueno en 30: son el mismo perfumero físico, pero
    // las unidades de verdad son las que él contó en el bueno.
    expect((await estadoDe(origen.id)).stock).toBe(-3);
    expect((await estadoDe(destino.id)).stock).toBe(30);

    await fusionarInsumos(origen.id, destino.id);

    // Lo que el dueño temía: que las 3 salidas viejas le bajaran el stock a 27.
    const despues = await estadoDe(destino.id);
    expect(despues.stock).toBe(30);
    // Y su costo promedio tampoco se mueve: no entró ni salió material.
    expect(despues.promedio).toBe(2100);
  });

  it('no se pierde ni un movimiento: los viejos quedan a nombre del bueno', async () => {
    const { origen, destino } = await sembrarDuplicados();

    await fusionarInsumos(origen.id, destino.id);

    const ventas = await prisma.movimientoInventario.findMany({
      where: { insumo_id: destino.id, tipo: 'venta' },
      orderBy: { referencia_id: 'asc' },
    });
    expect(ventas.map((m) => m.referencia_id)).toEqual([101, 102, 103]);
    expect(await prisma.movimientoInventario.count({ where: { insumo_id: origen.id } })).toBe(0);
  });

  it('deja rastro en el historial del bueno, sin mover stock ni costo', async () => {
    const { origen, destino } = await sembrarDuplicados();

    await fusionarInsumos(origen.id, destino.id);

    const rastro = await prisma.movimientoInventario.findFirst({
      where: { insumo_id: destino.id, tipo: 'ajuste', cantidad: 0 },
    });
    expect(rastro).not.toBeNull();
    expect(rastro?.nota).toContain('Perfumero Recargable');
    expect((await estadoDe(destino.id)).stock).toBe(30);
  });

  it('el duplicado desaparece de TODAS las tablas que lo apuntaban', async () => {
    const { origen, destino } = await sembrarDuplicados();

    // Una compra vieja del registro equivocado.
    const empresa = await prisma.empresa.create({ data: { nombre: 'Distribuidora X' } });
    const pago = await prisma.pagoProveedor.create({
      data: { dia: FECHA, empresa_id: empresa.id, valor_compra: 21000 },
    });
    await prisma.compraItem.create({
      data: {
        pago_id: pago.id, insumo_id: origen.id, cantidad: 20,
        subtotal: 21000, costo_unitario_final: 1050,
      },
    });

    // Una receta que lo usa como envase y otra que lo incluye como accesorio.
    const formula = await prisma.formulaVolumen.create({
      data: { nombre: '6 ml', ml_total: 6, esencia_ml: 3, envase_insumo_id: origen.id },
    });
    await prisma.formulaAccesorio.create({
      data: { formula_volumen_id: formula.id, insumo_id: origen.id },
    });

    // Un perfume que lo vende como producto y una talla que lo declara envase.
    const perfume = await prisma.perfume.create({
      data: { nombre: 'Perfumero suelto', precio: 8000, tipo_producto: 'comprado', insumo_producto_id: origen.id },
    });
    const presentacion = await prisma.presentacion.create({ data: { nombre: '6ml', ml: 6 } });
    await prisma.perfumePresentacion.create({
      data: {
        perfume_id: perfume.id,
        presentacion_id: presentacion.id,
        envase_insumo_id: origen.id,
        // La lista viva de accesorios: `consumoVenta` la lee en cada venta.
        accesorios: [origen.id],
      },
    });

    await fusionarInsumos(origen.id, destino.id);

    expect(await prisma.insumoCosto.findUnique({ where: { id: origen.id } })).toBeNull();
    expect(await prisma.compraItem.count({ where: { insumo_id: destino.id } })).toBe(1);
    expect(await prisma.formulaVolumen.count({ where: { envase_insumo_id: destino.id } })).toBe(1);
    expect(await prisma.formulaAccesorio.count({ where: { insumo_id: destino.id } })).toBe(1);
    expect(await prisma.perfume.count({ where: { insumo_producto_id: destino.id } })).toBe(1);
    expect(await prisma.perfumePresentacion.count({ where: { envase_insumo_id: destino.id } })).toBe(1);

    // El id de dentro del JSON también se muda: si no, la próxima venta de esa
    // talla reventaría con "El insumo no existe".
    const talla = await prisma.perfumePresentacion.findFirstOrThrow({
      where: { perfume_id: perfume.id },
    });
    expect(talla.accesorios).toEqual([destino.id]);
  });

  it('si una receta incluía a los DOS, queda una sola línea', async () => {
    const { origen, destino } = await sembrarDuplicados();
    const formula = await prisma.formulaVolumen.create({
      data: { nombre: '6 ml', ml_total: 6, esencia_ml: 3 },
    });
    await prisma.formulaAccesorio.createMany({
      data: [
        { formula_volumen_id: formula.id, insumo_id: origen.id },
        { formula_volumen_id: formula.id, insumo_id: destino.id },
      ],
    });

    await fusionarInsumos(origen.id, destino.id);

    // Una receta no puede incluir dos veces el mismo perfumero: la clave es
    // (receta, insumo). Mudar a ciegas reventaría con clave duplicada.
    expect(await prisma.formulaAccesorio.count({ where: { formula_volumen_id: formula.id } })).toBe(1);
  });

  it('no deja fusionar un registro consigo mismo', async () => {
    const { destino } = await sembrarDuplicados();
    await expect(fusionarInsumos(destino.id, destino.id)).rejects.toThrow(/mismo/i);
  });

  it('no deja fusionar contra un registro que ya no existe', async () => {
    const { origen } = await sembrarDuplicados();
    await expect(fusionarInsumos(origen.id, 999999)).rejects.toThrow(/no existe/i);
  });

  it('cuenta lo que se va a mover ANTES de mover nada', async () => {
    const { origen, destino } = await sembrarDuplicados();

    const usos = await contarUsos(origen.id);
    expect(usos.movimientos).toBe(3);
    expect(usos.compras).toBe(0);
    expect(usos.total).toBe(3);

    // La vista previa solo lee: el registro sigue igual después de preguntar.
    expect(await prisma.insumoCosto.count({ where: { id: { in: [origen.id, destino.id] } } })).toBe(2);
  });
});
