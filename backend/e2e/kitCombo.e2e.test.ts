import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { abrirDashboard, cabeceraAdmin, campo, cerrarNavegador, elegirProducto, irA, registrarVenta } from './navegador';
import { URL_API } from './arranque';
import { sembrarCategoria } from './tienda';

/**
 * RECORRIDO — el kit del combo (2026-09-28, ola 2 de los regalos).
 *
 * Un combo puede traer accesorios por defecto (su empaque). Cuando la venta
 * arma ese combo, sale en "Este pedido lleva" ya marcado, y al guardar entra
 * como REGALO: sale del inventario y no se cobra (empaque por línea,
 * 2026-10-04: el kit es un caso más del empaque). Lo que guarda el servidor está
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
  it('al armar el combo en una venta, su kit sale marcado y entra como regalo al guardar', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill('Recorrido kit del combo');

    // Tres perfumes de la misma categoría y talla: arman el "Combo 3 Kit"
    await elegirProducto(pagina, 'Kit 1');
    await pagina.getByLabel('Cantidad').fill('3');

    const kit = pagina.getByRole('checkbox', { name: /Perfumero Kit ×1/ });
    await kit.waitFor();
    expect(await kit.isChecked()).toBe(true);

    await campo(pagina, 'Valor de la venta (COP) *').fill('150000');
    await registrarVenta(pagina);
    await contexto.close();

    const venta = await prisma.venta.findFirstOrThrow({
      where: { persona: 'Recorrido kit del combo' }, include: { perfumes: true },
    });
    const perfumero = venta.perfumes.find((l) => l.perfume_id === perfumeroId);
    expect(perfumero).toMatchObject({ cantidad: 1, regalo: 1 });
  });
});
