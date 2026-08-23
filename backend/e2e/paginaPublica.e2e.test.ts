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

  /**
   * La barra del editor no la tocaba ninguna prueba, y sus ocho botones estaban
   * declarados DENTRO del editor: en cada tecla React los desmontaba y volvía a
   * montar (regla del proyecto, 2026-08-23). Al sacarlos fuera hay que
   * comprobar lo delicado, que es el `onMouseDown` + `preventDefault`: sin él,
   * pulsar el botón le roba la selección al texto y "Negrita" no aplica a nada.
   */
  it('la barra del editor pone negrita sin perder lo seleccionado', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/blog');
    await pagina.waitForSelector('text=+ Nueva entrada');
    await pagina.getByRole('button', { name: '+ Nueva entrada' }).click();

    const editor = pagina.locator('[contenteditable="true"]');
    await editor.fill('Esto va en negrita');
    await editor.click();
    await pagina.keyboard.press('Control+a');
    await pagina.getByTitle('Negrita').click();

    const html = await editor.innerHTML();
    expect(html).toMatch(/<(b|strong)[ >]/i);
    expect(await editor.innerText()).toContain('Esto va en negrita');

    await contexto.close();
  });

  /**
   * El enlace se pide DENTRO de la pantalla (antes era un `window.prompt`, una
   * ventana gris del sistema que además congela la página).
   *
   * Lo delicado y por lo que existe esta prueba: al escribir en la casilla el
   * foco se va del área editable y **el navegador pierde la selección**. Si el
   * rango no se guarda y se devuelve, `createLink` no tiene a qué aplicarse y
   * el botón no hace nada, en silencio.
   */
  it('el enlace se pide en la pantalla y se aplica a lo que estaba marcado', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/blog');
    await pagina.waitForSelector('text=+ Nueva entrada');
    await pagina.getByRole('button', { name: '+ Nueva entrada' }).click();

    const editor = pagina.locator('[contenteditable="true"]');
    await editor.fill('Mira el catálogo');
    await editor.click();
    await pagina.keyboard.press('Control+a');
    await pagina.getByTitle('Enlace').click();

    // Sin `window.prompt`: la casilla vive en la propia barra.
    const casilla = pagina.getByLabel('Dirección del enlace');
    await casilla.fill('celestialparfums.com/blog');
    await pagina.getByRole('button', { name: 'Poner enlace' }).click();

    // Sin esquema, el navegador armaría un enlace relativo a la tienda.
    const href = await editor.locator('a').first().getAttribute('href');
    expect(href).toBe('https://celestialparfums.com/blog');
    expect(await editor.locator('a').first().innerText()).toContain('Mira el catálogo');

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
