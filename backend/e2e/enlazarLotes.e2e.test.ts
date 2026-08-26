import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { registrarProduccion } from '../src/repositories/inventario.producciones';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el aviso que le crea a cada frasco su ficha.
 *
 * Se siembra el caso exacto que el dueño vio en producción el 2026-08-25: un
 * lote armado con un envase 1.1 cuya **ficha 1.1 no existe** (tiene 229
 * perfumes y cero). Antes el aviso le pedía elegir una ficha de un desplegable
 * vacío; ahora el botón la crea copiando la del corriente.
 *
 * Lo que vigila: que la ficha nazca copiada y APAGADA, que los frascos entren,
 * que el material no se mueva ni un ml, y que el lote desaparezca del aviso.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

describe('lotes por enlazar', () => {
  it('crea la ficha 1.1 que falta, le trae los frascos y vacía el aviso', async () => {
    const marca = Date.now();
    const formula = await prisma.formulaVolumen.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const esencia = await prisma.insumoCosto.findFirstOrThrow({
      where: { tipo: 'materia_prima' }, orderBy: { id: 'asc' },
    });
    // El corriente, con su ficha llena: es de él de quien se copia.
    const corriente = await prisma.perfume.update({
      where: { id: (await prisma.perfume.findFirstOrThrow({ orderBy: { id: 'asc' } })).id },
      data: { descripcion: 'Canela y vainilla', imagen_url: '/uploads/corriente.webp' },
    });
    // Su envase 1.1, distinto al del tamaño: es lo que delata al lote como 1.1.
    const envase11 = await prisma.insumoCosto.create({
      data: { nombre: `Envase 1.1 recorrido ${marca}`, tipo: 'envase', precio: 48680, stock: 5 },
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
    const NOMBRE = `Ficha 1.1 recorrido ${marca}`;

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/producciones');
    // Singular o plural: otros recorridos siembran sus propios lotes en esta
    // misma base, así que el aviso puede decir "1 lote" o "4 lotes".
    await pagina.getByText(/lotes? por enlazar/).first().waitFor({ timeout: 30_000 });

    const tarjeta = pagina.locator('li').filter({ hasText: `Lote ${lote.id} ` }).first();
    // El nombre llega propuesto a partir del corriente, y se puede corregir.
    const casilla = tarjeta.getByLabel('Nombre de la ficha 1.1');
    await expect.poll(() => casilla.inputValue()).toContain('1.1');
    await casilla.fill(NOMBRE);
    await pagina.screenshot({ path: foto('enlazar-crea-ficha') });

    await tarjeta.getByRole('button', { name: /Crear su ficha 1.1/ }).click();

    /**
     * Se espera a los FRASCOS, no a que exista la ficha.
     *
     * La ficha se crea al principio de la operación y los frascos entran al
     * final: esperar a la ficha y leer el stock a continuación es una carrera
     * que se pierde una de cada dos veces.
     */
    const stockDe = async (nombre: string) => {
      const ficha = await prisma.perfume.findFirst({ where: { nombre } });
      if (!ficha) return -1;
      const filas = await prisma.perfumePresentacion.findMany({ where: { perfume_id: ficha.id } });
      return filas.reduce((suma, f) => suma + Number(f.stock), 0);
    };
    await expect.poll(() => stockDe(NOMBRE), { timeout: 25_000 }).toBe(1);

    // 1. La ficha nació copiada del corriente y FUERA de la tienda.
    const creada = await prisma.perfume.findFirstOrThrow({ where: { nombre: NOMBRE } });
    expect(creada.descripcion).toBe('Canela y vainilla');
    expect(creada.imagen_url).toBe('/uploads/corriente.webp');
    expect(creada.solo_armado).toBe(true);
    expect(creada.publicado).toBe(false);

    // 2. El material no se movió ni un ml: es el mismo lote, solo cambió a
    //    dónde apuntan sus frascos.
    const esenciaDespues = Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id: esencia.id } })).stock);
    expect(esenciaDespues).toBeCloseTo(esenciaAntes, 2);

    // 3. Y el lote ya no está en el aviso.
    await expect.poll(() => pagina.locator('li').filter({ hasText: `Lote ${lote.id} ` }).count(),
      { timeout: 25_000 }).toBe(0);

    await contexto.close();
  }, 120_000);
});
