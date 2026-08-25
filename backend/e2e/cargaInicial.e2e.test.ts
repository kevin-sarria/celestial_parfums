import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — meter al sistema frascos que ya existían.
 *
 * Nace de una barrera real (2026-08-25): el dueño tenía 5 frascos 1.1 armados
 * hace semanas y NINGUNA forma de registrarlos. El único camino era registrar un
 * lote, y eso le habría descontado una esencia que ya gastó y que además no
 * contó al inventariar —contó solo el líquido suelto—, dejándole las esencias en
 * negativo por un gasto ya restado.
 *
 * Lo que vigila este recorrido es justo esa diferencia: que la pantalla sume los
 * frascos y **no toque ni un gramo de material**. Si alguien "arregla" esto
 * haciéndolo pasar por el camino de las producciones, aquí se cae.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

describe('frascos que ya estaban armados', () => {
  it('entran al inventario sin descontar esencia ni envases', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inventario');
    await pagina.waitForSelector('text=Registrar llegada');

    // Vive en "dar de alta", no en "registrar uso": aquí no sale nada, entra.
    await pagina.getByRole('button', { name: /^Materiales$/ }).click();
    await pagina.getByRole('menuitem', { name: /Frascos ya armados/ }).click();
    await pagina.waitForSelector('text=Frascos que ya tienes armados');

    await pagina.getByRole('button', { name: /Elige el producto/ }).click();
    await pagina.getByRole('option').first().click();
    await pagina.getByRole('button', { name: /Elige la talla/ }).click();
    await pagina.getByRole('option', { name: /30/ }).first().click();
    await pagina.getByLabel('¿Cuántos frascos?').fill('3');

    // El costo se propone solo con la receta de esa talla: sin eso, el dueño
    // tendría que calcular a mano lo que el sistema ya sabe.
    await expect.poll(() => pagina.getByLabel('¿Qué te costó cada uno? (COP)').inputValue())
      .not.toBe('');
    await pagina.screenshot({ path: foto('carga-inicial') });

    const antes = await prisma.insumoCosto.findMany({ orderBy: { id: 'asc' }, select: { stock: true } });
    const armadosAntes = await prisma.movimientoTerminado.count();
    // Se compara contra el ANTES, no contra cero: los recorridos comparten base
    // y alguno registra lotes, así que un total absoluto haría fallar a este
    // según el orden en que corran.
    const lotesAntes = await prisma.produccion.count();

    await pagina.getByRole('button', { name: /Agregar a mi inventario/ }).click();
    await pagina.locator('[role=dialog]').waitFor({ state: 'detached', timeout: 30_000 });

    // 1. Los frascos entraron, anotados como AJUSTE (no como un lote).
    await expect.poll(() => prisma.movimientoTerminado.count()).toBe(armadosAntes + 1);
    const ultimo = await prisma.movimientoTerminado.findFirstOrThrow({ orderBy: { id: 'desc' } });
    expect(ultimo.tipo).toBe('ajuste');
    expect(Number(ultimo.cantidad)).toBe(3);
    expect(await prisma.produccion.count()).toBe(lotesAntes);

    // 2. Y lo que de verdad importa: el material no se movió.
    const despues = await prisma.insumoCosto.findMany({ orderBy: { id: 'asc' }, select: { stock: true } });
    expect(despues.map((i) => Number(i.stock))).toEqual(antes.map((i) => Number(i.stock)));

    await contexto.close();
  }, 90_000);
});
