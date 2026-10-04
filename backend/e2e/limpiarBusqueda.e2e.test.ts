import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * "LIMPIAR TODO" NO REVIVE (dueño, 2026-10-03): buscaba en Ventas, limpiaba,
 * y al darle "Enlazar perfumes" la lista volvía a salir filtrada por lo de
 * antes, sin el botón de limpiar. La caja se vaciaba pero la pantalla seguía
 * recordando la búsqueda vieja, y la siguiente recarga la usaba.
 */

const PERSONAS = ['Limpieza Uno', 'Limpieza Dos'];

beforeAll(async () => {
  for (const persona of PERSONAS) {
    await prisma.venta.create({
      data: { dia: new Date('2026-10-03T12:00:00'), persona, cantidad_perfumes: 1, presentacion: '30ml', referencia_perfume: 'Prueba', valor_venta: 10000 },
    });
  }
});

afterAll(async () => {
  await prisma.venta.deleteMany({ where: { persona: { in: PERSONAS } } });
  await cerrarNavegador();
});

describe('la búsqueda de una tabla', () => {
  it('tras "Limpiar todo", Enlazar perfumes recarga la lista entera', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    const fila = (persona: string) => pagina.getByRole('row', { name: new RegExp(persona) });
    await fila('Limpieza Dos').waitFor();

    await pagina.getByPlaceholder(/Buscar en todos/).fill('Limpieza Uno');
    await fila('Limpieza Dos').waitFor({ state: 'detached' });
    await pagina.getByRole('button', { name: 'Limpiar todo' }).click();
    await fila('Limpieza Dos').waitFor();

    await pagina.getByRole('button', { name: /Enlazar perfumes/ }).click();
    await pagina.getByRole('button', { name: /Enlazar perfumes/ }).waitFor(); // terminó ("Enlazando…" → de vuelta)
    await pagina.waitForLoadState('networkidle');
    expect(await fila('Limpieza Dos').count()).toBe(1);
    expect(await fila('Limpieza Uno').count()).toBe(1);
    await contexto.close();
  });
});
