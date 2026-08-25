import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { registrarProduccion } from '../src/repositories/inventario.producciones';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el aviso que manda cada frasco a su ficha.
 *
 * Se siembra el caso exacto del lote 6 de Khamrah: un lote que gastó el envase
 * 1.1 y cuyos frascos quedaron colgados de la ficha del perfume corriente. Lo
 * que vigila el recorrido es que el aviso aparezca, que enlazar MUEVA los
 * frascos a la ficha 1.1 **sin tocar el material**, y que el lote desaparezca
 * de la lista después.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

describe('lotes por enlazar', () => {
  it('enlaza el lote a su ficha 1.1 y el aviso se vacía', async () => {
    const marca = Date.now();
    const formula = await prisma.formulaVolumen.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const presentacion = await prisma.presentacion.findFirstOrThrow({
      where: { formula_volumen_id: formula.id },
    });
    const corriente = await prisma.perfume.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const esencia = await prisma.insumoCosto.findFirstOrThrow({
      where: { tipo: 'materia_prima' }, orderBy: { id: 'asc' },
    });
    const envase11 = await prisma.insumoCosto.create({
      data: { nombre: `Envase 1.1 recorrido ${marca}`, tipo: 'envase', precio: 48680, stock: 5 },
    });
    // La ficha 1.1 que SÍ declara ese envase: es la que el aviso debe proponer.
    const ficha11 = await prisma.perfume.create({
      data: {
        nombre: `Khamrah 1.1 recorrido ${marca}`, precio: 150000, solo_armado: true, publicado: false,
        presentaciones: { create: { presentacion_id: presentacion.id, envase_insumo_id: envase11.id } },
      },
    });

    const lote = await registrarProduccion({
      fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      formula_volumen_id: formula.id,
      cantidad: 1,
      perfume_id: corriente.id,
      envase_insumo_id: envase11.id,
      consumos: [{ insumo_id: esencia.id, cantidad: 15 }, { insumo_id: envase11.id, cantidad: 1 }],
    });
    const esenciaAntes = Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id: esencia.id } })).stock);

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/producciones');
    // Singular o plural: otros recorridos siembran sus propios lotes en esta
    // misma base, así que el aviso puede decir "1 lote" o "4 lotes".
    await pagina.getByText(/lotes? por enlazar/).first().waitFor({ timeout: 30_000 });
    await pagina.screenshot({ path: foto('lotes-por-enlazar') });

    const tarjeta = pagina.locator('li').filter({ hasText: `Lote ${lote.id} ` }).first();
    // La ficha 1.1 llega propuesta: el dueño solo confirma.
    await expect.poll(() => tarjeta.innerText()).toContain(ficha11.nombre);
    await tarjeta.getByRole('button', { name: /Enlazar a su ficha/ }).click();

    // 1. Los frascos se mudaron a la ficha 1.1, con su costo.
    await expect.poll(async () => Number((await prisma.perfumePresentacion.findUnique({
      where: { perfume_id_presentacion_id: { perfume_id: ficha11.id, presentacion_id: presentacion.id } },
    }))?.stock ?? 0), { timeout: 25_000 }).toBe(1);

    // 2. Y el material no se movió ni un ml: es el mismo lote, solo cambió a
    //    dónde apuntan sus frascos.
    const esenciaDespues = Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id: esencia.id } })).stock);
    expect(esenciaDespues).toBeCloseTo(esenciaAntes, 2);

    // 3. El lote ya no está en la lista de pendientes.
    await expect.poll(() => pagina.locator('li').filter({ hasText: `Lote ${lote.id} ` }).count(),
      { timeout: 25_000 }).toBe(0);

    await contexto.close();
  }, 120_000);
});
