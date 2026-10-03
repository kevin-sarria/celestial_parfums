import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, abrirTienda, cerrarNavegador, irA } from './navegador';

/**
 * SEGUNDA TANDA DE LA REVISIÓN (2026-10-02): el buscador general del panel,
 * la meta del mes en Inicio y lo que se gana con una cuenta en el login.
 */

const PERSONA = 'Buscada Por Ctrl K';
const foto = (n: string) => path.join(os.tmpdir(), `celestial-tanda2-${n}.png`);

afterAll(async () => {
  await prisma.venta.deleteMany({ where: { persona: PERSONA } });
  await prisma.metaMensual.deleteMany({});
  await cerrarNavegador();
});

describe('el panel, segunda tanda', () => {
  it('Ctrl+K busca en todo y la pestaña abre filtrada', async () => {
    await prisma.venta.create({
      data: { dia: new Date('2026-09-20'), persona: PERSONA, cantidad_perfumes: 1, presentacion: '30ML', referencia_perfume: 'Ventas 1', valor_venta: 60000 },
    });
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inicio');
    // El atajo vive en el encabezado: se espera a que esté montado
    await pagina.getByRole('button', { name: 'Buscar en todo el panel' }).waitFor();
    await pagina.keyboard.press('Control+k');
    await pagina.getByRole('textbox', { name: 'Qué buscas' }).fill('Ctrl K');
    const opcion = pagina.getByRole('option', { name: new RegExp(PERSONA) });
    await opcion.waitFor();
    await pagina.screenshot({ path: foto('buscador') });
    await pagina.keyboard.press('Enter');

    await pagina.waitForURL(/\/dashboard\/ventas$/);
    // La tabla abre con el texto ya escrito, y la URL queda limpia
    await expect.poll(() => pagina.getByPlaceholder(/Buscar en todos/).first().inputValue()).toBe(PERSONA);
    await pagina.getByRole('cell', { name: PERSONA }).first().waitFor();
    await contexto.close();
  });

  it('la meta del mes se pone en Inicio y dice cuánto falta', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inicio');
    await pagina.getByRole('button', { name: 'Poner meta' }).click();
    await pagina.getByRole('spinbutton', { name: /Meta de ventas/ }).fill('3000000');
    await pagina.getByRole('button', { name: 'Guardar' }).click();
    await pagina.getByRole('progressbar').waitFor();
    await pagina.getByText(/Te faltan|Meta cumplida/).waitFor();
    expect(await prisma.metaMensual.count()).toBe(1);
    await pagina.screenshot({ path: foto('meta') });

    // En el celular, el encabezado con la lupa no se desborda
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.waitForTimeout(300);
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await pagina.screenshot({ path: foto('meta-celular') });
    await contexto.close();
  });

  it('el login dice lo que se gana con una cuenta', async () => {
    const { contexto, pagina } = await abrirTienda();
    await pagina.setViewportSize({ width: 390, height: 844 });
    await irA(pagina, '/login');
    await pagina.getByText('Guarda tus perfumes favoritos').waitFor();
    await pagina.screenshot({ path: foto('login'), fullPage: true });
    await contexto.close();
  });
});
