import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, estadoDe, limpiarBase } from '../test/baseDePrueba';
import { aplicarMovimiento, recalcularPromedio, revertirMovimientos } from './inventario.repository';

/**
 * El costo promedio ponderado: de aquí sale lo que "cuesta" cada material, y
 * con eso el margen de cada perfume y de cada cotización. Si este número se
 * tuerce no se nota en ninguna pantalla — se nota meses después en una
 * ganancia que no cuadra.
 *
 * Las reglas están en CLAUDE.md → "Inventario y costo promedio".
 */

const FECHA = new Date('2026-08-12');

/** Aplica un movimiento en su propia transacción, como hace el código real. */
const mover = (mov: Parameters<typeof aplicarMovimiento>[1]) =>
  prisma.$transaction((tx) => aplicarMovimiento(tx, mov));

describe('costo promedio ponderado', () => {
  beforeEach(limpiarBase);

  it('pondera lo que ya había con lo que llega: 200 ml a $380 más 500 a $420 dan $408,5714', async () => {
    const insumo = await crearInsumo('Esencia Clásica', { precio: 0 });

    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 200, costo_unitario: 380, fecha: FECHA });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 500, costo_unitario: 420, fecha: FECHA });

    // (200×380 + 500×420) / 700 = 286.000 / 700
    expect(await estadoDe(insumo.id)).toEqual({ stock: 700, promedio: 408.5714 });
  });

  it('con el stock en cero la compra manda: no se pondera contra nada', async () => {
    // El insumo nace con un precio de arranque tecleado a mano...
    const insumo = await crearInsumo('Esencia Clásica', { precio: 999, stock: 0 });

    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 100, costo_unitario: 380, fecha: FECHA });

    // ...y la primera compra lo reemplaza entero. Ponderar 999 contra un stock
    // de cero daría un promedio inventado.
    expect(await estadoDe(insumo.id)).toEqual({ stock: 100, promedio: 380 });
  });

  it('una salida se valora al promedio vigente y NO lo mueve', async () => {
    const insumo = await crearInsumo('Esencia Clásica', { precio: 0 });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 200, costo_unitario: 380, fecha: FECHA });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 500, costo_unitario: 420, fecha: FECHA });

    const salida = await mover({ insumo_id: insumo.id, tipo: 'produccion', cantidad: -150, fecha: FECHA });

    // Sacar material no altera lo que costó: solo baja el stock.
    expect(salida.costoAplicado).toBe(408.5714);
    expect(await estadoDe(insumo.id)).toEqual({ stock: 550, promedio: 408.5714 });
  });

  it('el promedio se puede reconstruir entero desde el libro de movimientos', async () => {
    const insumo = await crearInsumo('Esencia Clásica', { precio: 0 });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 200, costo_unitario: 380, fecha: FECHA });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 500, costo_unitario: 420, fecha: FECHA });
    await mover({ insumo_id: insumo.id, tipo: 'produccion', cantidad: -150, fecha: FECHA });

    // Se ensucia la proyección a mano, como si algo la hubiera descuadrado...
    await prisma.insumoCosto.update({ where: { id: insumo.id }, data: { stock: 1, precio: 1 } });
    await prisma.$transaction((tx) => recalcularPromedio(tx, insumo.id));

    // ...y el libro la devuelve a su sitio. Esta es la red de seguridad.
    expect(await estadoDe(insumo.id)).toEqual({ stock: 550, promedio: 408.5714 });
  });
});

describe('revertir una compra', () => {
  beforeEach(limpiarBase);

  it('deja el stock y el promedio exactamente como estaban antes', async () => {
    const insumo = await crearInsumo('Esencia Clásica', { precio: 0 });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 200, costo_unitario: 380, fecha: FECHA });
    const antes = await estadoDe(insumo.id);

    // Llega una segunda compra con su referencia (la factura) y luego se borra.
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 500, costo_unitario: 420, fecha: FECHA, referencia_id: 77 });
    expect((await estadoDe(insumo.id)).promedio).toBe(408.5714);

    await prisma.$transaction((tx) => revertirMovimientos(tx, 'compra', 77));

    expect(await estadoDe(insumo.id)).toEqual(antes);
    // Y el libro tampoco conserva rastro de la compra borrada.
    expect(await prisma.movimientoInventario.count({ where: { referencia_id: 77 } })).toBe(0);
  });

  it('borra solo los movimientos de ESA compra, no los de otra factura', async () => {
    const insumo = await crearInsumo('Esencia Clásica', { precio: 0 });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 200, costo_unitario: 380, fecha: FECHA, referencia_id: 1 });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 500, costo_unitario: 420, fecha: FECHA, referencia_id: 2 });

    await prisma.$transaction((tx) => revertirMovimientos(tx, 'compra', 2));

    expect(await estadoDe(insumo.id)).toEqual({ stock: 200, promedio: 380 });
  });

  /**
   * DISCREPANCIA (ya anotada en CLAUDE.md como caso de borde abierto).
   *
   * La regla dice que `insumos_costo.precio` es la PROYECCIÓN del libro de
   * movimientos. Al borrar la única compra el libro queda vacío, el stock sí
   * vuelve a cero... pero el precio se queda en el de la compra borrada, porque
   * `recalcularPromedio` solo escribe el precio `if (movs.length)`.
   *
   *   esperado: 380 (el precio de arranque del material)
   *   real:     420 (el que fijó la compra que ya no existe)
   *
   * Es lo que se vio en agosto con la Esencia Clásica en $383,18 en vez de $380.
   *
   * NO se arregla aquí: el precio de arranque **no se guarda en ninguna parte**
   * — la primera compra lo sobreescribe —, así que "volver al de partida" exige
   * una columna nueva y su migración. Decisión pendiente con el dueño.
   */
  it.skip('DISCREPANCIA: al vaciarse el libro, el precio vuelve al de partida', async () => {
    const insumo = await crearInsumo('Esencia Clásica', { precio: 380, stock: 0 });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 500, costo_unitario: 420, fecha: FECHA, referencia_id: 9 });

    await prisma.$transaction((tx) => revertirMovimientos(tx, 'compra', 9));

    expect(await estadoDe(insumo.id)).toEqual({ stock: 0, promedio: 380 });
  });

  it('el caso de borde de arriba, tal como se comporta HOY (para que el cambio se note)', async () => {
    const insumo = await crearInsumo('Esencia Clásica', { precio: 380, stock: 0 });
    await mover({ insumo_id: insumo.id, tipo: 'compra', cantidad: 500, costo_unitario: 420, fecha: FECHA, referencia_id: 9 });

    await prisma.$transaction((tx) => revertirMovimientos(tx, 'compra', 9));

    // El stock sí se corrige; el precio se queda en el de la compra borrada.
    expect(await estadoDe(insumo.id)).toEqual({ stock: 0, promedio: 420 });
  });
});
