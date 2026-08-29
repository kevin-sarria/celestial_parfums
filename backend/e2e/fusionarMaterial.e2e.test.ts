import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — fusionar dos registros del mismo material.
 *
 * Nace del caso real del 2026-08-29: el dueño acabó con dos fichas del mismo
 * perfumero, las dos con movimientos, y no podía borrar ninguna. Lo que le daba
 * miedo, textual, era que al unirlas *"me descuente lo que esté antes"*.
 *
 * Por eso lo que vigila este recorrido no es que el modal se abra, sino la
 * promesa que hace en pantalla: **el material bueno termina con las mismas
 * existencias con las que empezó**, y la historia del duplicado queda a su
 * nombre. Si alguien "arregla" esto recalculando el stock desde el libro, aquí
 * se cae.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

describe('fusionar dos registros del mismo material', () => {
  it('muda la historia del duplicado sin tocar las existencias del bueno', async () => {
    // Los dos perfumeros del caso real: el viejo con salidas y sin compras, y el
    // bueno con las unidades contadas a mano.
    const duplicado = await prisma.insumoCosto.create({
      data: { nombre: 'Perfumero Recargable (viejo)', tipo: 'accesorio', unidad: 'unidad', precio: 1050, stock: 0 },
    });
    const bueno = await prisma.insumoCosto.create({
      data: { nombre: 'Perfumero recargable 6 ml (bueno)', tipo: 'envase', unidad: 'unidad', precio: 2100, stock: 30 },
    });
    await prisma.movimientoInventario.createMany({
      data: [101, 102, 103].map((referencia_id) => ({
        insumo_id: duplicado.id, tipo: 'venta' as const, cantidad: -1,
        costo_unitario: 1050, fecha: new Date('2026-08-20'), referencia_id,
      })),
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inventario');
    await pagina.waitForSelector('text=Registrar llegada');

    // La fila del duplicado, por su nombre: el orden de la tabla no es asunto
    // de este recorrido.
    const fila = pagina.locator('tr', { hasText: 'Perfumero Recargable (viejo)' }).first();
    await fila.getByRole('button', { name: /Fusionar/ }).click();
    await pagina.waitForSelector('text=Fusionar "Perfumero Recargable (viejo)"');

    // La cuenta de lo que se va a mover la trae el servidor: es lo que hace que
    // nadie confirme a ciegas algo que no se puede deshacer.
    await pagina.getByText(/3 movimientos/).first().waitFor({ timeout: 10_000 });

    await pagina.getByRole('button', { name: /Elige el material que se queda/ }).click();
    await pagina.getByRole('option', { name: /Perfumero recargable 6 ml \(bueno\)/ }).click();

    // La respuesta a su pregunta, con el número delante, ANTES de confirmar.
    await pagina.getByText(/no se mueven/).first().waitFor({ timeout: 10_000 });
    await pagina.screenshot({ path: foto('fusionar-material') });

    await pagina.getByRole('button', { name: /^Fusionar$/ }).click();
    await pagina.locator('[role=dialog]').waitFor({ state: 'detached', timeout: 30_000 });

    // 1. Lo que el dueño temía: que las 3 salidas viejas le bajaran el stock.
    const quedo = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: bueno.id } });
    expect(Number(quedo.stock)).toBe(30);

    // 2. Y la historia no se perdió: los 3 movimientos son suyos.
    expect(await prisma.movimientoInventario.count({
      where: { insumo_id: bueno.id, tipo: 'venta' },
    })).toBe(3);
    expect(await prisma.insumoCosto.findUnique({ where: { id: duplicado.id } })).toBeNull();

    await contexto.close();
  }, 90_000);
});
