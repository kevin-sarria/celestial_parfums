import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, campo, cerrarNavegador, elegirOpcion, elegirProducto, irA } from './navegador';

/**
 * RECORRIDO — una garantía resuelta MUEVE el inventario.
 *
 * Hasta el 2026-08-30 no lo movía: reponer un frasco lo sacaba de la casa del
 * dueño y no de su sistema, y el que el cliente devolvía no volvía nunca. La
 * decisión suya ese día fue preguntarlo caso por caso, porque el motivo del
 * reclamo no alcanza para adivinar en qué estado llegó el frasco.
 *
 * Lo que vigila el recorrido es la cadena entera desde la pantalla: marcar las
 * dos casillas del formulario tiene que terminar en un frasco más en la repisa,
 * y borrar el caso tiene que devolverlo a como estaba.
 *
 * Usa `Ventas 3` a propósito: es el único de la semilla que ningún otro
 * recorrido toca, y este deja frascos armados por el camino.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

const armadosDe = async (nombre: string) => {
  const p = await prisma.perfume.findFirstOrThrow({ where: { nombre } });
  const fichas = await prisma.perfumePresentacion.findMany({ where: { perfume_id: p.id } });
  return fichas.reduce((t, f) => t + Number(f.stock), 0);
};

afterAll(cerrarNavegador);

describe('resolver una garantía', () => {
  it('lo devuelto y revendible vuelve a los frascos armados, y borrar el caso lo deshace', async () => {
    const perfume = 'Ventas 3';
    const cliente = `Cliente garantía ${Date.now()}`;
    const antes = await armadosDe(perfume);

    const { contexto, pagina } = await abrirDashboard();
    // Borrar el caso pregunta con un confirm del navegador; sin esto Playwright
    // lo rechaza por defecto y el borrado nunca ocurre.
    pagina.on('dialog', (d) => d.accept());

    // ── 1. UNA VENTA A LA QUE COLGARLE EL RECLAMO ────────────────────────────
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill(cliente);
    await elegirProducto(pagina, perfume);
    await campo(pagina, 'Valor de la venta (COP) *').fill('60000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector(`text=${cliente}`, { timeout: 30_000 });

    // ── 2. EL RECLAMO, RESUELTO Y CON EL FRASCO DE VUELTA ────────────────────
    await irA(pagina, '/dashboard/devoluciones');
    await pagina.waitForSelector('text=Registrar devolución');
    await pagina.getByRole('button', { name: /Registrar devolución/ }).click();

    await pagina.getByRole('button', { name: /Busca por cliente o por perfume/ }).click();
    await pagina.getByRole('option', { name: new RegExp(cliente) }).first().click();
    // La unidad que vuelve: sin marcarla no hay nada que devolver al inventario.
    await pagina.getByRole('button', { name: '+', exact: true }).first().click();

    await elegirOpcion(pagina, 'Estado', /Resuelta/);
    await elegirOpcion(pagina, '¿Qué hiciste?', /Le devolví el dinero/);
    await campo(pagina, '¿Cuánto dinero le devolviste?').fill('60000');

    await pagina.getByLabel(/El cliente me devolvió el producto/).check();
    await pagina.getByLabel(/Sí, vuelve a mi inventario/).check();
    // El renglón que le dice al dueño lo que va a pasar ANTES de guardar.
    await pagina.getByText(/tus frascos armados/).first().waitFor({ timeout: 15_000 });
    await pagina.screenshot({ path: foto('devolucion-inventario') });

    await pagina.getByRole('button', { name: /^Guardar$/ }).click();
    await expect.poll(() => armadosDe(perfume), { timeout: 30_000 }).toBe(antes + 1);

    // ── 3. BORRAR EL CASO LO DEJA COMO ESTABA ────────────────────────────────
    await pagina.getByRole('listitem').filter({ hasText: cliente })
      .getByRole('button', { name: 'Borrar' }).first().click();
    await expect.poll(() => armadosDe(perfume), { timeout: 30_000 }).toBe(antes);

    await contexto.close();
  }, 180_000);
});
