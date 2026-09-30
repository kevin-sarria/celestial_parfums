import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { toSlug } from '../src/utils/slug';
import {
  abrirDashboard, abrirTienda, cabeceraAdmin, campo, cerrarNavegador, cerrarPopup, elegirFecha, elegirOpcion, irA,
} from './navegador';
import { URL_API } from './arranque';

/**
 * RECORRIDO — llega un perfume ORIGINAL en una compra (dueño, 2026-09-29).
 *
 * Compró 15 originales y el modal de material nuevo no tenía cómo decir "esto
 * es una botella original". Este recorrido va por el camino real: registrar la
 * factura en BOTELLAS, dejar que el sistema copie la ficha del contratipo que
 * ya vendía, ponerle precio y verlo en la tienda con su etiqueta y sus tallas
 * con nombre de decant y de botella.
 */

afterAll(cerrarNavegador);

describe('un perfume original de punta a punta', () => {
  it('se compra en botellas, hereda la ficha del contratipo y sale en la tienda como Original', async () => {
    const FRAGANCIA = `Khamrah Recorrido ${Date.now()}`;
    const contratipo = await prisma.perfume.create({
      data: { nombre: FRAGANCIA, precio: 60000, descripcion: 'Dátil, canela y praliné', genero: 'unisex' },
    });

    const { contexto, pagina } = await abrirDashboard();

    // ── 1. La factura: material nuevo de tipo "Perfume original" ──
    await irA(pagina, '/dashboard/pagos');
    await pagina.waitForSelector('text=Registrar pago');
    await pagina.getByRole('button', { name: '+ Registrar pago' }).click();
    await elegirFecha(pagina, 'Día *', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
    await campo(pagina, 'Valor compra (COP) *').fill('400000');
    await pagina.getByRole('button', { name: /selecciona una empresa/i }).click();
    await pagina.getByRole('option', { name: '+ Registrar empresa nueva' }).click();
    const empresa = `Proveedor originales ${Date.now()}`;
    await campo(pagina, 'Nombre empresa *').fill(empresa);

    await pagina.getByRole('button', { name: /agregar insumo a la compra/i }).click();
    await pagina.getByRole('option', { name: /crear insumo nuevo/i }).click();
    await elegirOpcion(pagina, '¿Qué es?', /perfume original/i);
    await campo(pagina, '¿Qué perfume llegó?').fill(FRAGANCIA);
    await campo(pagina, '¿Cuántos ml trae la botella? *').fill('100');

    // El contratipo que ya vendía se propone solo para copiar su ficha
    await pagina.getByText(/con la foto, notas y descripción del contratipo/i).waitFor();
    await pagina.getByRole('button', { name: /crear y agregar/i }).click();

    // La línea entra en botellas: es como viene en la factura
    await pagina.getByLabel('Cantidad').waitFor();
    await pagina.getByLabel('Cantidad').fill('2');
    await pagina.getByLabel('Lo que costó').fill('400000');
    await pagina.getByText(/son 200 ml/).waitFor();
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector(`text=${empresa}`);
    await contexto.close();

    // ── 2. En la base: 200 ml a $2.000 el ml y la ficha Original heredada ──
    const material = await prisma.insumoCosto.findFirstOrThrow({ where: { nombre: `${FRAGANCIA} – Original 100 ml` } });
    expect(Number(material.stock)).toBe(200);
    expect(Number(material.precio)).toBe(2000);
    const original = await prisma.perfume.findFirstOrThrow({
      where: { nombre: `${FRAGANCIA} Original` }, include: { categoria: true },
    });
    expect(original.tipo_producto).toBe('fraccionado');
    expect(original.categoria?.nombre).toBe('Original');
    expect(original.descripcion).toBe('Dátil, canela y praliné');
    expect(original.publicado).toBe(false);
    expect(original.id).not.toBe(contratipo.id);

    // ── 3. Sin precio no se deja publicar; con precio, sí ──
    const publicar = async () => fetch(`${URL_API}/api/parfums/${original.id}/publicado`, {
      method: 'PATCH', headers: await cabeceraAdmin(), body: JSON.stringify({ publicado: true }),
    });
    expect((await publicar()).status).toBe(400);

    const tallas = await prisma.perfumePresentacion.findMany({
      where: { perfume_id: original.id }, include: { presentacion: true },
    });
    for (const t of tallas) {
      await prisma.perfumePresentacion.update({
        where: { perfume_id_presentacion_id: { perfume_id: t.perfume_id, presentacion_id: t.presentacion_id } },
        data: { precio: t.presentacion.ml === 100 ? 450000 : (t.presentacion.ml ?? 1) * 7000 },
      });
    }
    expect((await publicar()).ok).toBe(true);

    // ── 4. La tienda lo anuncia como Original, con decants y botella ──
    const tienda = await abrirTienda();
    await irA(tienda.pagina, `/perfume/${toSlug(original.nombre)}`);
    await cerrarPopup(tienda.pagina);
    await tienda.pagina.getByRole('heading', { name: original.nombre }).waitFor();
    await tienda.pagina.getByText('Original', { exact: true }).first().waitFor();
    await tienda.pagina.getByText(/Decant 3 ml/).first().waitFor();
    await tienda.pagina.getByText(/Botella 100 ml/).first().waitFor();
    await tienda.pagina.getByText('decants desde').first().waitFor();
    await tienda.contexto.close();
  });
});
