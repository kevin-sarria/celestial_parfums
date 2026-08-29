import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { registrarProduccion } from '../src/repositories/inventario.producciones';
import { abrirDashboard, campo, cerrarNavegador, elegirProducto, irA } from './navegador';

/**
 * RECORRIDO — vender un 1.1 que no está armado no lo FABRICA.
 *
 * Sale de auditar la lógica 1.1 con los datos del dueño delante (2026-08-29).
 * Dos agujeros, los dos silenciosos, y los dos se cierran en este camino:
 *
 * 1. **El precio.** La ficha 1.1 nacía copiando el precio del perfume corriente.
 *    Ahora el aviso enseña el de la lista de los 1.1 ANTES de crear.
 * 2. **El material.** Vender un 1.1 sin frascos armados descontaba esencia y
 *    envase como si lo hubiera armado. Ahora la venta pasa —ya ocurrió—, el
 *    frasco queda en negativo y la pantalla lo dice.
 *
 * Se prueba en el navegador y no solo con pruebas de base porque el segundo
 * agujero solo se alcanzaba **desde el dashboard**: la tienda esconde un 1.1 sin
 * armar, así que quien lo destapaba era el dueño registrando a mano.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

const stockDe = async (id: number) =>
  Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id } })).stock);

afterAll(cerrarNavegador);

describe('vender un 1.1 sin frascos armados', () => {
  it('enseña el precio de la lista al crearlo y luego no gasta ni un ml al venderlo', async () => {
    const marca = Date.now();
    const NOMBRE = `Khamrah recorrido ${marca} 1.1`;
    const formula = await prisma.formulaVolumen.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const presentacion = await prisma.presentacion.findFirstOrThrow({
      where: { formula_volumen_id: formula.id },
    });
    const esencia = await prisma.insumoCosto.findFirstOrThrow({
      where: { tipo: 'materia_prima' }, orderBy: { id: 'asc' },
    });
    const corriente = await prisma.perfume.findFirstOrThrow({ orderBy: { id: 'asc' } });

    // La lista de precios de los 1.1: es el número que tiene que salir en
    // pantalla, y NO el del perfume corriente.
    const categoria11 = await prisma.categoria.upsert({
      where: { nombre: '1.1' }, update: {}, create: { nombre: '1.1' },
    });
    await prisma.precioLista.upsert({
      where: {
        categoria_id_presentacion_id: {
          categoria_id: categoria11.id, presentacion_id: presentacion.id,
        },
      },
      update: { precio: 120000 },
      create: { categoria_id: categoria11.id, presentacion_id: presentacion.id, precio: 120000 },
    });

    const envase11 = await prisma.insumoCosto.create({
      data: { nombre: `Envase 1.1 venta ${marca}`, tipo: 'envase', precio: 48680, stock: 5 },
    });
    const lote = await registrarProduccion({
      fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      formula_volumen_id: formula.id,
      cantidad: 1,
      perfume_id: corriente.id,
      envase_insumo_id: envase11.id,
      consumos: [{ insumo_id: esencia.id, cantidad: 15 }, { insumo_id: envase11.id, cantidad: 1 }],
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/producciones');
    await pagina.getByText(/lotes? por enlazar/).first().waitFor({ timeout: 30_000 });

    const tarjeta = pagina.locator('li').filter({ hasText: `Lote ${lote.id} ` }).first();

    // 1. EL PRECIO viene de la lista de los 1.1, no del corriente.
    const precio = tarjeta.getByLabel(/^Precio/);
    await expect.poll(() => precio.inputValue(), { timeout: 15_000 }).toBe('120000');
    await tarjeta.getByLabel('Nombre de la ficha 1.1').fill(NOMBRE);
    await pagina.screenshot({ path: foto('11-precio-de-lista') });
    await tarjeta.getByRole('button', { name: /Crear su ficha 1.1/ }).click();

    const armadosDe = async () => {
      const ficha = await prisma.perfume.findFirst({ where: { nombre: NOMBRE } });
      if (!ficha) return -99;
      const filas = await prisma.perfumePresentacion.findMany({ where: { perfume_id: ficha.id } });
      return filas.reduce((suma, f) => suma + Number(f.stock), 0);
    };
    await expect.poll(armadosDe, { timeout: 25_000 }).toBe(1);

    // Aceptó el precio de la lista, así que la ficha NO guarda precio propio:
    // el día que suba la lista, sube con ella.
    const ficha = await prisma.perfume.findFirstOrThrow({ where: { nombre: NOMBRE } });
    const talla = await prisma.perfumePresentacion.findFirstOrThrow({
      where: { perfume_id: ficha.id },
    });
    expect(talla.precio).toBeNull();

    // 2. LA VENTA: dos unidades cuando solo hay UNA armada.
    const esenciaAntes = await stockDe(esencia.id);
    const envaseAntes = await stockDe(envase11.id);

    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill(`Cliente 1.1 ${marca}`);
    await elegirProducto(pagina, NOMBRE);
    await pagina.getByLabel('Cantidad').first().fill('2');
    await campo(pagina, 'Valor de la venta (COP) *').fill('240000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();

    // El aviso sale en pantalla: antes esto se calculaba y no lo leía nadie.
    await pagina.getByText(/sin tenerlo armado/).first().waitFor({ timeout: 30_000 });
    await pagina.screenshot({ path: foto('11-aviso-sin-armar') });
    await contexto.close();

    // 3. Ni un ml de esencia, ni un envase: lo que antes se iba en silencio.
    expect(await stockDe(esencia.id)).toBeCloseTo(esenciaAntes, 2);
    expect(await stockDe(envase11.id)).toBeCloseTo(envaseAntes, 2);
    // Y el frasco que no existía queda en −1, a la vista en "Frascos ya armados".
    await expect.poll(armadosDe, { timeout: 15_000 }).toBe(-1);
  }, 150_000);
});
