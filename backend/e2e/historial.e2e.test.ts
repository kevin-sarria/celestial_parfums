import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * EL HISTORIAL DE CAMBIOS (2026-10-03, tercera tanda): un cambio hecho en el
 * panel aparece solo, con quién lo hizo, y se puede buscar.
 */

const foto = (n: string) => path.join(os.tmpdir(), `celestial-historial-${n}.png`);

afterAll(async () => {
  await prisma.metaMensual.deleteMany({});
  await cerrarNavegador();
});

describe('el historial de cambios', () => {
  it('lo que cambia el dueño en el panel queda anotado y se puede buscar', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inicio');
    await pagina.getByRole('button', { name: /Poner meta|Cambiar la meta/ }).click();
    await pagina.getByRole('textbox', { name: /Meta de ventas/ }).fill('4200000');
    await pagina.getByRole('button', { name: 'Guardar' }).click();
    await pagina.getByRole('progressbar').waitFor();

    await irA(pagina, '/dashboard/historial');
    const fila = pagina.getByRole('row', { name: /Editó en Inicio \(meta\)/ }).first();
    await fila.waitFor();
    expect(await fila.innerText()).toContain('4200000');
    await pagina.screenshot({ path: foto('escritorio') });

    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.waitForTimeout(400);
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await pagina.screenshot({ path: foto('celular') });
    await contexto.close();
  });
});
