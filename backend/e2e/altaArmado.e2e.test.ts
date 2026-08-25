import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — dar de alta un 1.1 sin salir de donde se arma.
 *
 * El dueño tenía 5 frascos 1.1 sin ficha porque registrarlos obligaba a irse a
 * otra pantalla y llenar 16 campos, doce de los cuales no le aplican. Textual
 * (2026-08-25): *"es una barrera grande"*. Este recorrido vigila que la barrera
 * siga quitada: cuatro casillas dentro del propio modal del lote.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

describe('alta de un 1.1 desde el lote', () => {
  it('se crea con cuatro casillas, apagado, y queda elegido para el lote', async () => {
    const NOMBRE = `Bon Bon 1.1 recorrido ${Date.now()}`;
    const { contexto, pagina } = await abrirDashboard();

    await irA(pagina, '/dashboard/inventario');
    await pagina.waitForSelector('text=Registrar llegada');
    await pagina.getByRole('button', { name: /^Registrar uso$/ }).click();
    await pagina.getByRole('menuitem', { name: /Armé perfumes/ }).click();
    await pagina.waitForSelector('text=Registrar producción');

    // El buscador arranca en "Sin especificar", que es la opción por defecto.
    // "+ Crear …" va PRIMERO en la lista: al final nadie descubre que existe.
    await pagina.getByRole('button', { name: /Sin especificar/ }).click();
    const opciones = pagina.locator('[role="option"]');
    expect((await opciones.first().innerText())).toContain('Crear producto nuevo');
    await opciones.first().click();

    await pagina.getByLabel('¿Cómo se llama?').fill(NOMBRE);
    await pagina.getByLabel('¿A cuánto lo vendes? *').fill('150000');
    await pagina.getByRole('button', { name: /Elige la talla/ }).click();
    await pagina.getByRole('option', { name: /30/ }).first().click();
    await pagina.screenshot({ path: foto('alta-armado') });

    await pagina.getByRole('button', { name: /^Crear y seguir$/ }).click();
    await pagina.waitForSelector(`text=${NOMBRE}`);

    // 1. Nace apagado y como producto que solo se vende armado.
    const creado = await prisma.perfume.findFirstOrThrow({ where: { nombre: NOMBRE } });
    expect(creado.publicado).toBe(false);
    expect(creado.solo_armado).toBe(true);

    // 2. Y queda elegido en el lote: el dueño sigue armando sin buscarlo de nuevo.
    await expect.poll(() => pagina.locator('button', { hasText: NOMBRE }).count())
      .toBeGreaterThan(0);

    await contexto.close();
  }, 90_000);
});
