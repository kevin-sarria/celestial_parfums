import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO 7 — una talla nueva nace sabiendo sus mililitros.
 *
 * El dueño crea sus tallas él mismo desde Clasificaciones, y las de los
 * ORIGINALES (90 ml, 125 ml…) no existen todavía. Guardando solo el nombre, la
 * talla quedaba sin número: el sistema la trata como "no es un tamaño", no le
 * enlaza receta y **no la costea** — cada venta suya entra con costo cero y la
 * ganancia del mes sale inflada.
 *
 * Se prueba en navegador porque lo que hace confiable la regla es **verla**: el
 * número aparece bajo el nombre, así que si un día dejara de deducirse, el
 * dueño lo nota al crearla y no seis meses después en un informe.
 */

afterAll(cerrarNavegador);

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

describe('crear una talla desde Clasificaciones', () => {
  it('le lee el tamaño al nombre y lo muestra', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/presentaciones');
    await pagina.waitForSelector('text=+ Nueva presentación');

    await pagina.getByRole('button', { name: '+ Nueva presentación' }).click();
    await campo(pagina, 'Nombre *').fill('90 ML');
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();

    const fila = pagina.getByRole('row', { name: /90 ML/ });
    await fila.waitFor();
    expect(await fila.innerText()).toContain('90 ml');

    await pagina.screenshot({ path: foto('tallas-con-ml') });

    await contexto.close();
  });

  it('avisa cuando el nombre no dice ningún tamaño', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/presentaciones');
    await pagina.waitForSelector('text=+ Nueva presentación');

    await pagina.getByRole('button', { name: '+ Nueva presentación' }).click();
    await campo(pagina, 'Nombre *').fill('Estuche de viaje');
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();

    const fila = pagina.getByRole('row', { name: /Estuche de viaje/ });
    await fila.waitFor();
    // Se permite crearla —hay cosas que no son tamaños— pero se dice en la cara
    // que esa no se costea, en vez de dejarlo en silencio.
    expect(await fila.innerText()).toMatch(/no la costea/i);

    await contexto.close();
  });
});
