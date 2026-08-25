import { afterAll, describe, expect, it } from 'vitest';
import { elegirTipoDeAlta, abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO 5 — el selector de esencia lista lo que está CLASIFICADO, no lo que
 * se llama de cierta forma.
 *
 * Nació de un fallo que encontró el dueño el 2026-08-13: sus esencias "Herod",
 * "Perseus" y "Layton" (de Parfums de Marly) estaban cargadas, clasificadas como
 * árabes y con stock, y aun así el formulario del perfume **no las listaba**,
 * porque las buscaba por la palabra "esencia" dentro del nombre.
 *
 * Y era un círculo cerrado: el modal del material tampoco enseñaba la casilla de
 * gama a quien no tuviera esa palabra, así que tampoco se podían clasificar.
 * Cinco materiales quedaron inservibles sin que nada lo dijera.
 *
 * Un perfume con la esencia mal puesta **no descuenta nada al venderse** y su
 * costo entra en cero, así que la ganancia del mes sale inflada.
 */

afterAll(cerrarNavegador);

const SIN_LA_PALABRA = 'Herod by Parfums de Marly';

describe('con qué esencia se hace un perfume', () => {
  it('lista una esencia clasificada aunque su nombre NO diga "esencia"', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForSelector('text=+ Nuevo perfume');

    await pagina.getByRole('button', { name: '+ Nuevo perfume' }).click();
    // El alta pregunta primero qué es (2026-08-25): se elige la puerta y de ahí
    // sale el formulario con los campos que aplican.
    await elegirTipoDeAlta(pagina, /Una fragancia que fabrico/);
    await pagina.getByRole('button', { name: /Sin asignar/ }).click();

    const panel = pagina.getByRole('listbox');
    await panel.waitFor();
    await expect(panel.getByRole('option', { name: new RegExp(SIN_LA_PALABRA) })).toBeTruthy();
    expect(await panel.innerText()).toContain(SIN_LA_PALABRA);

    await contexto.close();
  });

  it('el panel se despliega POR ENCIMA del modal, no recortado dentro', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForSelector('text=+ Nuevo perfume');

    await pagina.getByRole('button', { name: '+ Nuevo perfume' }).click();
    await elegirTipoDeAlta(pagina, /Una fragancia que fabrico/);
    await pagina.getByRole('button', { name: /Sin asignar/ }).click();
    await pagina.getByRole('listbox').waitFor();

    // Lo que importa no es DE QUIÉN cuelga, sino que esté fuera del contenedor
    // que scrollea: ahí dentro quedaba recortado y se veía a medias. (Cuelga del
    // diálogo, no del <body>, porque si no Radix le roba el foco al buscador.)
    const fueraDelScroll = await pagina.evaluate(() => {
      const panel = document.querySelector('[role="listbox"]')?.parentElement;
      const cuerpo = document.querySelector('[data-slot="dialog-content"] .overflow-y-auto');
      return Boolean(panel && cuerpo && !cuerpo.contains(panel));
    });
    expect(fueraDelScroll).toBe(true);

    // Y se ve entero: nada de la lista queda fuera de la pantalla.
    const caja = await pagina.getByRole('listbox').boundingBox();
    const alto = await pagina.evaluate(() => window.innerHeight);
    expect(caja).not.toBeNull();
    expect(caja!.y).toBeGreaterThanOrEqual(0);
    // Y con aire respecto al borde: pegado abajo el último renglón se lee a medias.
    expect(alto - (caja!.y + caja!.height)).toBeGreaterThanOrEqual(8);

    await contexto.close();
  });
});
