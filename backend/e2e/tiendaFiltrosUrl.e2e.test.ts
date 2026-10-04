import { afterAll, describe, expect, it } from 'vitest';
import { abrirTienda, cerrarNavegador, cerrarPopup, irA } from './navegador';

/**
 * RECORRIDO — la búsqueda y los filtros de la tienda viven en la dirección
 * (2026-10-04, aprobado por el dueño): un enlace compartido abre la tienda ya
 * filtrada, y recargar no pierde nada. Lo demás que traiga la dirección (las
 * marcas de TikTok, un código de invitado) NO se borra.
 */
afterAll(cerrarNavegador);

describe('los filtros de la tienda en la dirección', () => {
  it('un enlace abre ya filtrado, conserva las marcas de TikTok y sobrevive a recargar', async () => {
    const { contexto, pagina } = await abrirTienda();
    await irA(pagina, '/perfumes?utm_source=tiktok&q=Carrito&genero=dama');
    await cerrarPopup(pagina);
    const buscador = pagina.locator('input[value="Carrito"]').first();
    await buscador.waitFor();

    const params = () => new URL(pagina.url()).searchParams;
    await expect.poll(() => params().get('utm_source')).toBe('tiktok');
    expect(params().get('q')).toBe('Carrito');
    expect(params().get('genero')).toBe('dama');

    // Cambiar la búsqueda se escribe en la dirección sin tocar lo demás
    await buscador.fill('Ventas');
    await expect.poll(() => params().get('q'), { timeout: 5_000 }).toBe('Ventas');
    expect(params().get('utm_source')).toBe('tiktok');
    expect(params().get('genero')).toBe('dama');

    // Recargar no pierde la vista
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await cerrarPopup(pagina);
    await pagina.locator('input[value="Ventas"]').first().waitFor();
    await contexto.close();
  });
});
