import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, abrirTienda, cerrarNavegador, cerrarPopup, irA } from './navegador';
import { PRECIOS } from './tienda';

/**
 * RECORRIDO 4 — cambiar la lista de precios mueve a toda una categoría.
 *
 * El precio no vive en el perfume: sale de una cascada. Mover una casilla de
 * Catálogo → Precios cambia a TODOS los perfumes de esa categoría de una vez, y
 * los que tienen precio propio **no se enteran**. Esa segunda mitad es la que
 * importa: si un cambio de lista pisara las excepciones, subir precios en
 * bloque destrozaría en silencio los precios especiales.
 *
 * Regla en CLAUDE.md → "Precios por presentación (base de todo lo demás)".
 */

afterAll(cerrarNavegador);

/** Como los ve el cliente: "$ 70.000" o "$70.000" según el navegador. */
const enPesos = (valor: number) =>
  new RegExp(`\\$\\s?${valor.toLocaleString('es-CO').replace(/\./g, '\\.')}`);

describe('la lista de precios manda sobre toda su categoría', () => {
  it('cambiar la casilla de 30 ml mueve los perfumes de esa categoría, menos el que tiene precio propio', async () => {
    // ── Antes: los tres primeros al precio de lista, el cuarto al suyo ──
    const cliente = await abrirTienda();
    await irA(cliente.pagina, '/perfumes?q=Precios');
    await cliente.pagina.waitForSelector('text=Precios 1');
    await cerrarPopup(cliente.pagina);
    const antes = await cliente.pagina.locator('body').innerText();
    expect(antes).toMatch(enPesos(PRECIOS.unidad));
    expect(antes).toMatch(enPesos(PRECIOS.propio));
    await cliente.contexto.close();

    // ── El dueño cambia UNA casilla ──
    const admin = await abrirDashboard();
    await irA(admin.pagina, '/dashboard/precios');
    await admin.pagina.waitForSelector('text=Precios');

    const fila = admin.pagina.locator('tr', { hasText: 'Precios' }).first();
    const casilla = fila.locator('input[type="number"]').first();
    await casilla.fill(String(PRECIOS.nuevo));
    await casilla.press('Enter');
    // El visto de "guardado" es la confirmación de que el servidor respondió.
    await fila.locator('svg').first().waitFor({ timeout: 15_000 }).catch(() => {});
    await admin.pagina.waitForTimeout(1500);
    await admin.contexto.close();

    // ── Después: la tienda ya cobra el nuevo precio ──
    const despues = await abrirTienda();
    await irA(despues.pagina, '/perfumes?q=Precios');
    await despues.pagina.waitForSelector('text=Precios 1');
    await cerrarPopup(despues.pagina);
    const texto = await despues.pagina.locator('body').innerText();

    expect(texto).toMatch(enPesos(PRECIOS.nuevo));
    // La excepción sigue en lo suyo: un cambio de lista no pisa precios propios.
    expect(texto).toMatch(enPesos(PRECIOS.propio));
    // Y el precio viejo desapareció de esta categoría.
    expect(texto).not.toMatch(enPesos(PRECIOS.unidad));

    await despues.contexto.close();
  });
});
