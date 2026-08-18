import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el mismo arreglo de `filtroServidor.e2e.test.ts`, pero en la
 * tabla de Perfumes: confirma que la CLAVE de cada columna del frontend
 * (`columns.tsx`) coincide con la que espera `mapaFiltrosPerfumes` en el
 * backend. Un typo en cualquiera de los dos lados deja el filtro mudo en
 * silencio — no revienta, simplemente no encuentra nada — y eso no lo agarra
 * el compilador porque la clave viaja como texto dentro de un JSON.
 *
 * La tienda sembrada trae 12 perfumes ("Carrito 1-4", "Precios 1-4",
 * "Ventas 1-4") ordenados del más nuevo al más viejo; con 10 por página,
 * "Carrito 1" (el primero que se sembró) queda en la página 2.
 */

afterAll(cerrarNavegador);

describe('el filtro de columna de Perfumes busca en toda la data', () => {
  it('encuentra un perfume que no está en la primera página', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForSelector('text=Ventas 4');
    // Sembrado antes que los demás → queda al final del orden "más nuevo primero".
    expect(await pagina.getByText('Carrito 1', { exact: true }).count()).toBe(0);

    await pagina.getByTitle('Filtrar por Nombre').click();
    await pagina.waitForSelector('text=Filtrar: Nombre');
    await pagina.getByPlaceholder('Escribe la palabra a buscar...').fill('Carrito 1');
    await pagina.getByRole('button', { name: 'Aplicar' }).click();

    await pagina.waitForSelector('text=Carrito 1', { timeout: 10_000 });
    expect(await pagina.getByText('Ventas 4', { exact: true }).count()).toBe(0);

    await contexto.close();
  });
});
