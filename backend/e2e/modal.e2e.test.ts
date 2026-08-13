import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO 6 — el modal tiene encabezado y pie anclados.
 *
 * Lo pidió el dueño el 2026-08-13 con una captura: al bajar por el formulario
 * de perfume se iban con el contenido el título, el botón de cerrar y los
 * botones de guardar. Quedabas a media pantalla sin saber qué estabas editando
 * ni cómo salir.
 *
 * Se comprueba **desplazando de verdad** hasta el fondo y mirando que las tres
 * cosas sigan en pantalla. Es un solo componente (`Modal`) el que lo resuelve
 * para los 25 modales del dashboard, así que si se rompe, se rompe en todos a
 * la vez — de ahí que valga la pena tener la prueba.
 */

afterAll(cerrarNavegador);

describe('los modales del dashboard', () => {
  it('mantienen el título, la X y los botones al desplazar un formulario largo', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForSelector('text=+ Nuevo perfume');
    await pagina.getByRole('button', { name: '+ Nuevo perfume' }).click();

    const dialogo = pagina.getByRole('dialog');
    await dialogo.waitFor();
    const titulo = dialogo.getByText('Nuevo perfume', { exact: true });
    const guardar = dialogo.getByRole('button', { name: /^Crear perfume$/ });
    const cerrar = dialogo.getByRole('button', { name: /close/i });

    // Antes de desplazar ya se ven los tres.
    await expect(titulo).toBeTruthy();
    expect(await titulo.isVisible()).toBe(true);
    expect(await guardar.isVisible()).toBe(true);

    // Hasta el fondo del formulario, como haría cualquiera.
    const cuerpo = dialogo.locator('div.overflow-y-auto').first();
    await cuerpo.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await pagina.waitForTimeout(300);

    const desplazado = await cuerpo.evaluate((el) => el.scrollTop);
    expect(desplazado).toBeGreaterThan(100); // se desplazó de verdad

    // Y siguen ahí: eso es lo que fallaba.
    expect(await titulo.isVisible()).toBe(true);
    expect(await guardar.isVisible()).toBe(true);
    expect(await cerrar.isVisible()).toBe(true);

    // El título arriba y los botones abajo, con el contenido entre medias.
    const cajaTitulo = (await titulo.boundingBox())!;
    const cajaCuerpo = (await cuerpo.boundingBox())!;
    const cajaGuardar = (await guardar.boundingBox())!;
    expect(cajaTitulo.y).toBeLessThan(cajaCuerpo.y);
    expect(cajaGuardar.y).toBeGreaterThan(cajaCuerpo.y + cajaCuerpo.height - 1);

    await contexto.close();
  });
});
