import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirTienda, cabeceraAdmin, cerrarNavegador, cerrarPopup, irA } from './navegador';
import { URL_API } from './arranque';

/**
 * RECORRIDO — un accesorio publicado vive en /accesorios, no en /perfumes
 * (2026-09-28, Ola 3 del diseño de Productos y Accesorios).
 */

afterAll(cerrarNavegador);

beforeAll(async () => {
  // Por la API: crear y publicar limpian la caché del catálogo
  const alta = await fetch(`${URL_API}/api/parfums/create`, {
    method: 'POST',
    headers: await cabeceraAdmin(),
    body: JSON.stringify({
      nombre: 'Bolsa de organza', precio: 3000, tipo_producto: 'comprado', es_accesorio: true,
      tipos_aroma: [], ocasiones: [], presentaciones: [],
    }),
  });
  expect(alta.ok).toBe(true);
  const { data: { id } } = await alta.json();
  const publicar = await fetch(`${URL_API}/api/parfums/${id}/publicado`, {
    method: 'PATCH', headers: await cabeceraAdmin(), body: JSON.stringify({ publicado: true }),
  });
  expect(publicar.ok).toBe(true);
});

describe('la sección de accesorios de la tienda', () => {
  it('muestra el accesorio en /accesorios, lo saca de /perfumes y aparece en el menú', async () => {
    const { contexto, pagina } = await abrirTienda();

    await irA(pagina, '/accesorios');
    await cerrarPopup(pagina);
    await pagina.getByText('Bolsa de organza').first().waitFor();

    await irA(pagina, '/perfumes?q=Bolsa');
    await pagina.getByText(/perfumes? disponibles?/).waitFor();
    expect(await pagina.getByText('Bolsa de organza').count()).toBe(0);

    // El pie de página ya ofrece la sección
    expect(await pagina.locator('footer').getByRole('link', { name: 'Accesorios' }).count()).toBe(1);

    await contexto.close();
  });
});
