import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO 8 — el menú lateral, que es por donde el dueño se mueve TODO el día.
 *
 * No tenía ni una prueba: los demás recorridos entran por la URL directa, así
 * que el cajón —el único camino real entre apartados— se podía romper sin que
 * nada avisara. Se escribió antes de sacarlo a su propio componente, para que
 * la mudanza tuviera red.
 *
 * Cubre las tres cosas que tienen que seguir funcionando: que se abra, que las
 * secciones se plieguen y desplieguen, y que al elegir un apartado se navegue
 * y el cajón se cierre solo.
 */

afterAll(cerrarNavegador);

const abrirCajon = (pagina: Awaited<ReturnType<typeof abrirDashboard>>['pagina']) =>
  pagina.locator('header button[aria-label="Abrir menú de apartados"]').click();

describe('el menú lateral', () => {
  it('lleva de un apartado a otro y se cierra al elegir', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForSelector('text=+ Nuevo perfume');

    await abrirCajon(pagina);

    // La sección del apartado actual arranca desplegada; las demás, plegadas
    // (los apartados de una sección plegada no existen en la página).
    const inventario = pagina.getByRole('button', { name: 'Inventario', exact: true });
    expect(await inventario.count()).toBe(0);

    await pagina.getByRole('button', { name: 'Producción e inventario', exact: true }).click();
    await inventario.waitFor({ state: 'visible' });
    await inventario.click();

    // Navegó de verdad (la URL manda: recargar conserva dónde estabas)…
    await pagina.waitForSelector('text=Valor del inventario');
    expect(new URL(pagina.url()).pathname).toBe('/dashboard/inventario');
    // …y el cajón se cerró solo, sin tener que tocar nada más (se espera a que
    // termine la animación de salida en vez de mirar el instante exacto).
    await inventario.waitFor({ state: 'hidden' });

    await contexto.close();
  });

  it('al volver a abrirlo, la sección del apartado en el que estás ya está desplegada', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/producciones');
    await pagina.waitForSelector('text=Armado este mes');

    await abrirCajon(pagina);

    // Sin esto habría que adivinar en qué grupo vive el apartado actual.
    await pagina.getByRole('button', { name: 'Producciones', exact: true }).waitFor({ state: 'visible' });

    await contexto.close();
  });
});
