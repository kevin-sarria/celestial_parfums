import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el filtro de columna busca en TODA la data, no solo la página.
 *
 * Nace del reporte del dueño (2026-08-18): "Filtrar: Referencia" solo miraba
 * las filas de la página ya cargada (`useTableControls` filtraba en el
 * navegador sobre `rows`, que en una tabla paginada por servidor son solo
 * las 10 de esa página). Con 300 ventas y la que buscas en la página 5, el
 * filtro decía "sin resultados" mintiendo. Se arregló mandando el filtro al
 * servidor (`?filtros=`, ver `backend/src/utils/filtros.ts`), igual que ya
 * viajaba la búsqueda global.
 *
 * La prueba siembra MÁS de una página (10) de ventas, con la que se busca
 * en la fecha más VIEJA (para que el orden por defecto, `dia: desc`, la deje
 * fuera de la primera página) y confirma que el filtro la encuentra igual.
 */

afterAll(cerrarNavegador);

describe('el filtro de columna busca en toda la data, no solo la página', () => {
  it('encuentra una venta que no está en la primera página', async () => {
    const hoy = new Date();
    // 11 ventas recientes: llenan de sobra la primera página (10).
    await prisma.venta.createMany({
      data: Array.from({ length: 11 }, (_, i) => ({
        dia: new Date(hoy.getTime() - i * 86_400_000),
        persona: `Relleno ${i}`,
        cantidad_perfumes: 1,
        presentacion: '30ML',
        referencia_perfume: 'Relleno',
        valor_venta: 50000,
        pagada: true,
      })),
    });
    // La que se busca: mucho más vieja, queda en la página 2 o después.
    await prisma.venta.create({
      data: {
        dia: new Date('2020-01-01'),
        persona: 'Referencia Única De La Prueba',
        cantidad_perfumes: 1,
        presentacion: '30ML',
        referencia_perfume: 'Buscada',
        valor_venta: 50000,
        pagada: true,
      },
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Relleno 0');

    await pagina.getByTitle('Filtrar por Persona').click();
    await pagina.waitForSelector('text=Filtrar: Persona');
    await pagina.getByPlaceholder('Escribe la palabra a buscar...').fill('Referencia Única De La Prueba');
    await pagina.getByRole('button', { name: 'Aplicar' }).click();

    // Si el filtro solo mirara la página cargada, esto NUNCA aparecería:
    // la venta buscada quedó en la página 2 por su fecha viejísima.
    await pagina.waitForSelector('text=Referencia Única De La Prueba', { timeout: 10_000 });
    expect(await pagina.getByText('Relleno 0').count()).toBe(0);

    await contexto.close();
  });

  /**
   * RECORRIDO — "Limpiar todo" con búsqueda Y filtro activos a la vez.
   *
   * Nace de otro reporte del dueño (2026-08-18): el botón vaciaba la cajita de
   * búsqueda, pero la tabla se quedaba con los resultados de la última
   * búsqueda. Causa: `handleClearAll` disparaba DOS recargas casi juntas
   * (`onServerSearch('')` y `onServerFilter({})`), y cada una llevaba el valor
   * VIEJO de lo que limpiaba la otra — la que respondiera de última ganaba
   * con la tabla a medio limpiar. Se arregló con `onServerClearAll`: una sola
   * recarga con las dos cosas vacías, sin carrera posible.
   */
  it('"Limpiar todo" con búsqueda y filtro activos deja la tabla completa, no a medias', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Relleno 0');

    // Filtro de columna: solo la venta "Referencia Única De La Prueba".
    await pagina.getByTitle('Filtrar por Persona').click();
    await pagina.waitForSelector('text=Filtrar: Persona');
    await pagina.getByPlaceholder('Escribe la palabra a buscar...').fill('Referencia Única De La Prueba');
    await pagina.getByRole('button', { name: 'Aplicar' }).click();
    await pagina.waitForSelector('text=Referencia Única De La Prueba');

    // Búsqueda global que, CON el filtro puesto, no calza con nada: la tabla
    // queda vacía. Es la combinación que expone la carrera.
    await pagina.getByPlaceholder('Buscar en todos los registros...').fill('Relleno');
    await pagina.waitForSelector('text=Sin ventas registradas', { timeout: 5_000 });

    await pagina.getByRole('button', { name: 'Limpiar todo' }).click();

    // El total de VERDAD (12 = 11 Relleno + 1 Referencia Única) es lo único
    // que prueba que las DOS cosas quedaron limpias A LA VEZ: si ganó la
    // carrera la recarga que limpiaba solo la búsqueda (con el filtro viejo
    // colgando) el total da 1; si ganó la que limpiaba solo el filtro (con la
    // búsqueda vieja colgando) el total da 11. Ninguna de las dos es 12.
    await pagina.waitForSelector('text=12 registros', { timeout: 10_000 });
    expect(await pagina.locator('input[placeholder="Buscar en todos los registros..."]').inputValue()).toBe('');
    expect(await pagina.getByText(/filtro.*activo/i).count()).toBe(0);

    await contexto.close();
  });
});
