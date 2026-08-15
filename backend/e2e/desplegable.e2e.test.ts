import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO 6 — el desplegable respeta la caja que le da la pantalla.
 *
 * Lo reportó el dueño el 2026-08-14 con una captura del modal de perfume: el
 * campo "Frasco del tamaño" salía con el texto cortado y la lista se abría
 * pegada al campo.
 *
 * La causa era una sola y estaba en la PIEZA COMPARTIDA: `BuscadorSelect`
 * documenta que las clases van al CONTENEDOR ("de ahí salen el ancho y el alto
 * del campo"), pero el botón fijaba su propio `h-9`. Una pantalla que pedía un
 * campo bajo (`h-8`) se quedaba con un botón de 36px dentro de una caja de
 * 32px: el botón sobresalía 4px y, como el panel se coloca desde el borde
 * inferior del CONTENEDOR, se abría 4px más arriba de donde termina el campo.
 *
 * Se mide en vez de mirarse: "se ve pegado" no se verifica, "1px de aire en vez
 * de 4" sí.
 */

/**
 * UNA sola sesión para todo el archivo: el servidor corta a los 10 intentos de
 * entrada cada 15 minutos y el conjunto de recorridos ya gasta varios. Abrir una
 * sesión por prueba tumbaba el resto de archivos con un 429 que no dice nada del
 * sistema.
 */
const sesion = abrirDashboard();

afterAll(async () => {
  await (await sesion).contexto.close();
  await cerrarNavegador();
});

/** Abre el modal de perfume con una presentación activa y el frasco a la vista. */
const abrirFrascoDelTamano = async (ancho: number) => {
  const { pagina } = await sesion;
  await pagina.setViewportSize({ width: ancho, height: 900 });
  await irA(pagina, '/dashboard/perfumes');
  await pagina.waitForSelector('text=+ Nuevo perfume');
  await pagina.getByRole('button', { name: '+ Nuevo perfume' }).click();

  // El selector de frasco solo aparece con la presentación marcada.
  const casilla = pagina.locator('input[type="checkbox"]').first();
  await casilla.scrollIntoViewIfNeeded();
  await casilla.check();

  const boton = pagina.getByRole('button', { name: /Frasco del tama/ });
  await boton.waitFor();
  await boton.scrollIntoViewIfNeeded();
  return { pagina, boton };
};

describe('el desplegable dentro del modal de perfume', () => {
  it('el campo cabe en su caja y el panel no se le monta encima', async () => {
    const { pagina, boton } = await abrirFrascoDelTamano(1366);
    await boton.click();
    await pagina.getByRole('listbox').waitFor();

    const m = await pagina.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Frasco del tama'))!;
      const panel = document.querySelector('[role="listbox"]')!.parentElement as HTMLElement;
      const c = btn.parentElement!.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      return {
        altoCaja: c.height, altoCampo: b.height,
        anchoCampo: b.width, anchoPanel: p.width,
        aireAbajo: p.top - b.bottom,
        aireArriba: b.top - p.bottom,
      };
    });

    // El botón no puede sobresalir de su contenedor: de ahí sale el ancla del panel.
    expect(m.altoCampo).toBe(m.altoCaja);
    // Regla ya vigente en ventas: el panel mide lo mismo que el campo.
    expect(Math.abs(m.anchoPanel - m.anchoCampo)).toBeLessThanOrEqual(2);
    // Y abre con aire, hacia donde quepa, nunca montado sobre el campo.
    expect(Math.max(m.aireAbajo, m.aireArriba)).toBeGreaterThanOrEqual(3);
    await pagina.keyboard.press('Escape');
  });

  it('no corta el texto del campo ni desborda la fila en celular', async () => {
    for (const ancho of [1366, 390]) {
      const { pagina } = await abrirFrascoDelTamano(ancho);

      const m = await pagina.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('Frasco del tama'))!;
        const texto = btn.querySelector('span') as HTMLElement;
        const fila = btn.parentElement!.parentElement!;
        return {
          pide: texto.scrollWidth,
          cabe: texto.clientWidth,
          desborde: fila.scrollWidth - fila.clientWidth,
        };
      });

      // El texto del campo se lee entero: "Frasco del tama…" no dice nada.
      expect(m.pide).toBeLessThanOrEqual(m.cabe);
      // En celular la fila baja de renglón en vez de salirse del modal.
      expect(m.desborde).toBeLessThanOrEqual(1);
    }
  });
});
