import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { toSlug } from '../src/utils/slug';
import { URL_API } from './arranque';
import { abrirDashboard, abrirTienda, cabeceraAdmin, campo, cerrarNavegador, cerrarPopup, elegirProducto, irA, registrarVenta } from './navegador';
import { sembrarCategoria } from './tienda';

/**
 * RECORRIDO — el empaque por línea y talla (dueño, 2026-10-04).
 *
 * El dueño marca en Catálogo → Empaque qué lleva un contratipo de esa talla; al
 * vender sale "Este pedido lleva", marcado; desmarcarlo no lo agrega; dejarlo
 * lo agrega como regalo. La tienda dice "Incluye …".
 */

const foto = (n: string) => path.join(os.tmpdir(), `celestial-empaque-${n}.png`);
let bolsaId = 0;
let tallaNombre = '';
let perfumeNombre = '';

afterAll(async () => {
  await prisma.empaqueLinea.deleteMany({ where: { perfume_id: bolsaId } });
  await cerrarNavegador();
});

beforeAll(async () => {
  const presentacion = await prisma.presentacion.findFirstOrThrow({ where: { ml: { not: null } } });
  tallaNombre = presentacion.nombre;
  const { perfumes } = await sembrarCategoria('Empaque', presentacion.id);
  perfumeNombre = perfumes[0].nombre;

  const insumo = await crearInsumo('Bolsa del empaque', { tipo: 'accesorio', precio: 300, stock: 50 });
  const alta = await fetch(`${URL_API}/api/parfums/create`, {
    method: 'POST',
    headers: await cabeceraAdmin(),
    body: JSON.stringify({
      nombre: 'Bolsa Empaque', precio: 0, tipo_producto: 'comprado',
      insumo_producto_id: insumo.id, es_accesorio: true,
      tipos_aroma: [], ocasiones: [], presentaciones: [],
    }),
  });
  const cuerpo = await alta.json();
  expect(alta.ok, JSON.stringify(cuerpo)).toBe(true);
  bolsaId = cuerpo.data.id;
});

const vender = async (persona: string, conBolsa: boolean) => {
  const { contexto, pagina } = await abrirDashboard();
  await irA(pagina, '/dashboard/ventas');
  await pagina.getByRole('button', { name: /registrar venta/i }).click();
  await campo(pagina, 'Persona *').fill(persona);
  await elegirProducto(pagina, perfumeNombre);
  await pagina.keyboard.press('Escape');
  const bolsa = pagina.getByRole('checkbox', { name: /Bolsa Empaque ×1/ });
  await bolsa.waitFor();
  expect(await bolsa.isChecked()).toBe(true);
  if (!conBolsa) await bolsa.uncheck();
  else await pagina.screenshot({ path: foto('venta') });
  await campo(pagina, 'Valor de la venta (COP) *').fill('60000');
  await registrarVenta(pagina);
  await contexto.close();
  return prisma.venta.findFirstOrThrow({ where: { persona }, include: { perfumes: true } });
};

describe('el empaque por línea', () => {
  it('el dueño le pone la bolsa al contratipo de una talla', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/empaque');
    const contratipo = pagina.getByRole('region', { name: 'Contratipo' });
    await contratipo.waitFor();
    // La talla puede venir ya sembrada por la migración; si no, se agrega
    if (await contratipo.getByText(tallaNombre, { exact: true }).count() === 0) {
      await contratipo.getByRole('button', { name: 'Agregar talla a Contratipo' }).click();
      await pagina.getByRole('option', { name: tallaNombre, exact: true }).click();
    }
    await contratipo.getByRole('button', { name: `Agregar a ${tallaNombre}` }).click();
    await pagina.getByRole('option', { name: 'Bolsa Empaque' }).click();
    await contratipo.getByRole('button', { name: 'Guardar' }).click();
    await pagina.getByText('Contratipo: empaque guardado').waitFor();
    await pagina.screenshot({ path: foto('pantalla') });
    // En el celular, una tarjeta por línea que no se sale de la pantalla
    await pagina.setViewportSize({ width: 390, height: 844 });
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await pagina.screenshot({ path: foto('celular') });
    await contexto.close();

    expect(await prisma.empaqueLinea.count({ where: { linea: 'contratipo', perfume_id: bolsaId } })).toBe(1);
  });

  it('al vender sale marcado: desmarcado no se agrega, marcado entra como regalo', async () => {
    const sin = await vender('Recorrido sin empaque', false);
    expect(sin.perfumes.find((l) => l.perfume_id === bolsaId)).toBeUndefined();

    const con = await vender('Recorrido con empaque', true);
    expect(con.perfumes.find((l) => l.perfume_id === bolsaId)).toMatchObject({ cantidad: 1, regalo: 1 });
    // La bolsa no cuenta como perfume
    expect(con.cantidad_perfumes).toBe(1);
  });

  it('la tienda dice lo que incluye la talla', async () => {
    const { contexto, pagina } = await abrirTienda();
    await irA(pagina, `/perfume/${toSlug(perfumeNombre)}`);
    await cerrarPopup(pagina);
    await pagina.getByText(/Incluye bolsa empaque/).first().waitFor();
    await pagina.screenshot({ path: foto('tienda') });
    await contexto.close();
  });
});
