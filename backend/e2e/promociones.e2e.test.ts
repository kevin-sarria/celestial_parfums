import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — lo que el dueño configura para atraer y fidelizar: el popup de la
 * tienda y la tarjeta de sellos.
 *
 * Las dos pantallas escriben cosas que ve el CLIENTE, así que un guardado que
 * no llega no se nota desde el dashboard: la pantalla se queda con el valor
 * viejo en memoria y parece que sí quedó. Por eso las dos comprueban recargando.
 *
 * Se escribió al pasarlas a la capa HTTP única.
 */

afterAll(cerrarNavegador);

describe('la publicidad de la tienda', () => {
  it('un anuncio nuevo queda guardado y se ve en la lista', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/publicidad');
    await pagina.waitForSelector('text=+ Nuevo anuncio');

    const titulo = `Envío gratis ${Date.now()}`;
    await pagina.getByRole('button', { name: '+ Nuevo anuncio' }).click();
    await campo(pagina, 'Título *').fill(titulo);
    await campo(pagina, 'Mensaje').fill('Por compras de más de $150.000 en agosto.');
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();

    await pagina.waitForSelector(`text=${titulo}`);
    await pagina.getByRole('dialog').waitFor({ state: 'hidden' });

    // Recargar es lo que separa "se guardó" de "se pintó en pantalla".
    await irA(pagina, '/dashboard/publicidad');
    await pagina.waitForSelector(`text=${titulo}`);

    await contexto.close();
  });
});

describe('la tarjeta de recompensas', () => {
  it('guarda cuántos sellos y qué premio, y sigue así al volver', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/recompensas');
    await pagina.waitForSelector('text=Configurar tarjeta');

    const premio = `Un decant de regalo ${Date.now()}`;
    await pagina.getByRole('button', { name: /configurar tarjeta/i }).click();
    await campo(pagina, 'Sellos para ganar el premio *').fill('8');
    await campo(pagina, 'Premio al completar la tarjeta *').fill(premio);
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
    await pagina.getByRole('dialog').waitFor({ state: 'hidden' });

    await irA(pagina, '/dashboard/recompensas');
    await pagina.getByRole('button', { name: /configurar tarjeta/i }).click();
    expect(await campo(pagina, 'Sellos para ganar el premio *').inputValue()).toBe('8');
    expect(await campo(pagina, 'Premio al completar la tarjeta *').inputValue()).toBe(premio);

    await contexto.close();
  });
});
