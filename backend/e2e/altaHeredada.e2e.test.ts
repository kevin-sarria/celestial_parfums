import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el 1.1 que hereda la ficha de su perfume corriente.
 *
 * Sale de un dato medido en producción: 229 perfumes y CERO fichas 1.1. No es
 * que no los venda; es que llenar otra vez la descripción, las notas y el
 * género de un jugo que ya está en el sistema cuesta más de lo que rinde.
 *
 * Y de una decisión del dueño (2026-08-25): publicar sin foto **avisa, no
 * bloquea**. Eso es lo que vigila la segunda mitad de este recorrido.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

describe('crear un 1.1 que hereda del corriente', () => {
  it('copia la ficha, nace apagado y se publica avisando de la foto', async () => {
    const NOMBRE = `Heredado 1.1 recorrido ${Date.now()}`;
    /**
     * El corriente del que se hereda es uno que YA está en el catálogo, con su
     * ficha rellenada para la ocasión. Crear uno nuevo aquí no serviría: el
     * catálogo del dashboard se sirve cacheado, así que un perfume recién
     * insertado a mano no aparecería en el desplegable hasta que el caché
     * caduque, y el recorrido fallaría por algo que no es lo que vigila.
     */
    const corriente = await prisma.perfume.update({
      where: { id: (await prisma.perfume.findFirstOrThrow({ orderBy: { id: 'asc' } })).id },
      data: {
        descripcion: 'Canela, vainilla y un fondo dulce',
        duracion: '8 horas',
        proyeccion: 'Alta',
        genero: 'unisex',
      },
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inventario');
    await pagina.waitForSelector('text=Registrar llegada');
    await pagina.getByRole('button', { name: /^Registrar uso$/ }).click();
    await pagina.getByRole('menuitem', { name: /Armé perfumes/ }).click();
    await pagina.waitForSelector('text=Registrar producción');

    await pagina.getByRole('button', { name: /Sin especificar/ }).click();
    await pagina.locator('[role="option"]').first().click();

    await pagina.getByLabel('¿Cómo se llama?').fill(NOMBRE);
    await pagina.getByLabel('¿A cuánto lo vendes? *').fill('150000');
    await pagina.getByRole('button', { name: /Elige la talla/ }).click();
    await pagina.getByRole('option', { name: /30/ }).first().click();

    // La pregunta nueva: de qué perfume es este 1.1.
    await pagina.getByRole('button', { name: /No, es uno nuevo/ }).click();
    await pagina.getByRole('option', { name: corriente.nombre }).first().click();
    await pagina.screenshot({ path: foto('alta-heredada') });

    await pagina.getByRole('button', { name: /^Crear y seguir$/ }).click();
    await pagina.waitForSelector(`text=${NOMBRE}`);

    // 1. Heredó lo que comparten, y sigue naciendo apagado.
    const creado = await prisma.perfume.findFirstOrThrow({ where: { nombre: NOMBRE } });
    expect(creado.descripcion).toBe('Canela, vainilla y un fondo dulce');
    expect(creado.duracion).toBe('8 horas');
    expect(creado.genero).toBe('unisex');
    expect(creado.publicado).toBe(false);

    // 2. Publicar sin foto AVISA y deja seguir: el dueño decide.
    await pagina.getByRole('button', { name: /Publicar en la tienda/ }).click();
    await pagina.waitForSelector('text=tarjeta sin imagen');
    await pagina.screenshot({ path: foto('publicar-sin-foto') });
    await pagina.getByRole('button', { name: /^Publicar igual$/ }).click();

    await expect.poll(
      async () => (await prisma.perfume.findUniqueOrThrow({ where: { id: creado.id } })).publicado,
      { timeout: 20_000 },
    ).toBe(true);

    await contexto.close();
  }, 90_000);
});
