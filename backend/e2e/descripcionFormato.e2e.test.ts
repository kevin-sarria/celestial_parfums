import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, abrirTienda, cerrarNavegador, irA } from './navegador';
import { URL_TIENDA } from './arranque';

/**
 * DESCRIPCIONES CON FORMATO (opción B del dueño, 2026-10-02): el editor del
 * blog pasó a ser el campo Descripción de perfumes, combos y Contáctame.
 *
 * Dos cosas que solo se ven en pantalla: que la tienda pinte la negrita (y no
 * los asteriscos que el dueño ya escribía), y que el editor guarde lo que se
 * marca con sus botones.
 */

afterAll(async () => {
  await prisma.combo.deleteMany({ where: { nombre: 'Combo con formato' } });
  await prisma.perfume.deleteMany({ where: { nombre: 'Perfume con formato' } });
  await cerrarNavegador();
});

const captura = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

describe('descripciones con formato', () => {
  it('la tienda pinta en negrita lo que estaba escrito con ** y no enseña los asteriscos', async () => {
    await prisma.perfume.create({
      data: {
        nombre: 'Perfume con formato', precio: 50000, publicado: true,
        descripcion: '✨ **Lleva tu aroma favorito a todas partes** ✨\n\nPerfumero recargable y práctico.',
      },
    });
    const { contexto, pagina } = await abrirTienda();
    await pagina.goto(`${URL_TIENDA}/perfume/perfume-con-formato`);
    const negrita = pagina.locator('.texto-enriquecido strong');
    await negrita.waitFor();
    expect(await negrita.innerText()).toBe('Lleva tu aroma favorito a todas partes');
    expect(await pagina.locator('.texto-enriquecido').innerText()).not.toContain('**');
    expect(await pagina.locator('.texto-enriquecido p').count()).toBe(2);
    await pagina.screenshot({ path: captura('descripcion-tienda') });
    await contexto.close();
  });

  it('el botón Negrita del editor queda guardado', async () => {
    const combo = await prisma.combo.create({
      data: { nombre: 'Combo con formato', cantidad: 3, precio: 150000, descripcion: 'Texto viejo' },
    });
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/combos');
    await pagina.getByRole('row', { name: /Combo con formato/ }).getByTitle('Editar').click();

    const editor = pagina.getByRole('textbox', { name: 'Descripción' });
    await editor.click();
    await pagina.keyboard.press('Control+A');
    await pagina.keyboard.type('Tres perfumes a elegir');
    await pagina.keyboard.press('Control+A');
    await pagina.getByTitle('Negrita').click();
    await pagina.keyboard.press('End');
    await pagina.getByTitle('Cursiva').click();
    await pagina.keyboard.type(' y en cursiva');
    // Manrope no tiene cursiva y la página prohíbe inventarla: sin permitirlo
    // aquí, el botón marcaba el texto pero no se veía nada (dueño, 2026-10-02).
    expect(await editor.evaluate((el) => getComputedStyle(el).getPropertyValue('font-synthesis-style'))).toBe('auto');
    await editor.locator('i, em').first().screenshot({ path: captura('descripcion-cursiva') });
    await pagina.screenshot({ path: captura('descripcion-editor') });

    await pagina.getByRole('button', { name: 'Guardar cambios' }).click();
    await pagina.getByText('Editar combo').waitFor({ state: 'detached' });

    const guardado = await prisma.combo.findUniqueOrThrow({ where: { id: combo.id } });
    expect(guardado.descripcion).toMatch(/<(b|strong)>Tres perfumes a elegir/);
    expect(guardado.descripcion).toMatch(/<(i|em)>\s?y en cursiva<\/(i|em)>/);
    await contexto.close();
  });
});
