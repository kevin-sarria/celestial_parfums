import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — Blog y Contáctame, las dos pantallas con las que el dueño edita
 * la cara pública de la tienda.
 *
 * Se escribió al pasarlas a la capa HTTP única (`http` + `urls`). No comprueban
 * diseño: comprueban que **lo que se guarda vuelve**. Un refactor de red se
 * rompe justo así —la pantalla se pinta igual, dice "guardado" y el dato nunca
 * llegó— y eso no lo ve ninguna prueba de aritmética.
 */

afterAll(cerrarNavegador);

describe('el blog', () => {
  it('crea una entrada y la muestra en la lista', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/blog');
    await pagina.waitForSelector('text=+ Nueva entrada');

    const titulo = `Cómo elegir tu perfume ${Date.now()}`;
    await pagina.getByRole('button', { name: '+ Nueva entrada' }).click();
    await campo(pagina, 'Título').fill(titulo);
    await pagina.locator('[contenteditable="true"]').fill('Empieza por la ocasión, no por la marca.');
    await pagina.getByRole('button', { name: 'Guardar' }).click();

    // Vuelve de la lista recargada: si el POST hubiera fallado en silencio, el
    // modal se habría cerrado igual y aquí no habría nada.
    await pagina.waitForSelector(`text=${titulo}`);
    await pagina.waitForSelector('text=Borrador');
    // El formulario se cierra solo: si se quedara abierto, el siguiente clic en
    // "Guardar" crearía la entrada por segunda vez.
    await pagina.getByRole('dialog').waitFor({ state: 'hidden' });

    await contexto.close();
  });
});

describe('la página Contáctame', () => {
  it('guarda el nombre a mostrar y sigue ahí al recargar', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/redes');
    await pagina.waitForSelector('text=Página Contáctame');

    const nombre = `Celestial Parfums ${Date.now()}`;
    await campo(pagina, 'Nombre a mostrar').fill(nombre);
    await pagina.getByRole('button', { name: 'Guardar cambios' }).click();
    await pagina.waitForSelector('text=Configuración guardada');

    // El aviso verde lo pinta la pantalla; el que manda es el servidor.
    await irA(pagina, '/dashboard/redes');
    await pagina.waitForSelector('text=Página Contáctame');
    expect(await campo(pagina, 'Nombre a mostrar').inputValue()).toBe(nombre);

    await contexto.close();
  });
});
