import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { abrirDashboard, cabeceraAdmin, campo, cerrarNavegador, elegirProducto, irA } from './navegador';
import { URL_API } from './arranque';
import { sembrarCategoria } from './tienda';

/**
 * RECORRIDO — el kit del combo (2026-09-28, ola 2 de los regalos).
 *
 * Un combo puede traer accesorios por defecto. Cuando la venta arma ese combo,
 * aparece "Combo … trae: 1 perfumero" con un botón, y un clic los agrega como
 * REGALO: salen del inventario y no se cobran. Lo que guarda el servidor está
 * probado en `combo.kit.bd.test.ts`; aquí se vigila la pantalla de Ventas.
 */

afterAll(cerrarNavegador);

let perfumeroId = 0;

beforeAll(async () => {
  const presentacion = await prisma.presentacion.findFirstOrThrow();
  const { combo } = await sembrarCategoria('Kit', presentacion.id);

  const insumo = await crearInsumo('Perfumero del kit', { tipo: 'accesorio', precio: 5000, stock: 20 });
  // Por la API y no con Prisma: limpia la caché del catálogo, así en Ventas
  // aparecen el accesorio y los perfumes "Kit" recién sembrados
  const alta = await fetch(`${URL_API}/api/parfums/create`, {
    method: 'POST',
    headers: await cabeceraAdmin(),
    body: JSON.stringify({
      nombre: 'Perfumero Kit', precio: 5000, tipo_producto: 'comprado',
      insumo_producto_id: insumo.id, es_accesorio: true,
      tipos_aroma: [], ocasiones: [], presentaciones: [],
    }),
  });
  expect(alta.ok).toBe(true);
  ({ data: { id: perfumeroId } } = await alta.json());

  await prisma.comboContenido.create({ data: { combo_id: combo.id, perfume_id: perfumeroId, cantidad: 1 } });
});

describe('el kit del combo', () => {
  it('al armar el combo en una venta, ofrece su kit y lo agrega como regalo', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill('Recorrido kit del combo');

    // Tres perfumes de la misma categoría y talla: arman el "Combo 3 Kit"
    await elegirProducto(pagina, 'Kit 1');
    await pagina.getByLabel('Cantidad').fill('3');

    await pagina.getByText(/Combo 3 Kit trae: 1 Perfumero Kit/).waitFor();
    await pagina.getByRole('button', { name: 'Agregar como regalo' }).click();
    // Ya agregado, el aviso desaparece: no se ofrece dos veces
    await expect.poll(() => pagina.getByRole('button', { name: 'Agregar como regalo' }).count()).toBe(0);

    await campo(pagina, 'Valor de la venta (COP) *').fill('150000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector('text=Recorrido kit del combo', { timeout: 30_000 });
    await contexto.close();

    const venta = await prisma.venta.findFirstOrThrow({
      where: { persona: 'Recorrido kit del combo' }, include: { perfumes: true },
    });
    const perfumero = venta.perfumes.find((l) => l.perfume_id === perfumeroId);
    expect(perfumero).toMatchObject({ cantidad: 1, regalo: 1 });
  });
});
