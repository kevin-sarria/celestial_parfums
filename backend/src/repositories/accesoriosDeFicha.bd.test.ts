import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { conAccesoriosDeFicha } from './accesoriosDeFicha';
import { quitarAccesoriosSobrantes, revisarAccesoriosSobrantes } from './accesoriosSobrantes';
import { recetaDe } from './inventario.consumoVenta';
import { registrarProduccion } from './inventario.producciones';
import { createPerfume } from './perfume.repository';

/**
 * UN 1.1 NO LLEVA BOLSA NI PERFUMERO, Y EL SISTEMA YA NO SE LOS COBRA.
 *
 * Dueño, 2026-08-30: "al generar un perfume 1.1 estos normalmente no llevan
 * bolsa de organza o perfumero… actualmente el coste no es el real". Medido el
 * 2026-09-27: los 27 lotes 1.1 de producción los cargaron ($54.300).
 *
 * La ficha por talla dice: null = los de la receta; [] = ninguno; [ids] = los suyos.
 */

const sembrar = async () => {
  const s = await sembrarFabricacion30ml();
  const bolsa = await crearInsumo('Bolsa Organza', { tipo: 'accesorio', precio: 300, stock: 100 });
  const tarjeta = await crearInsumo('Tarjeta', { tipo: 'accesorio', precio: 500, stock: 100 });
  await prisma.formulaAccesorio.create({ data: { formula_volumen_id: s.formula.id, insumo_id: bolsa.id } });
  await prisma.perfumePresentacion.create({ data: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id } });
  const ponerAccesorios = (v: number[] | null) => prisma.perfumePresentacion.update({
    where: { perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id } },
    data: { accesorios: v ?? undefined },
  });
  return { ...s, bolsa, tarjeta, ponerAccesorios };
};

const stock = async (id: number) => Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id } })).stock);

describe('qué accesorios lleva un frasco', () => {
  beforeEach(limpiarBase);

  it('sin nada propio (null), los de la receta', async () => {
    const s = await sembrar();
    const r = await recetaDe(s.perfume.id, 30);
    expect(r?.items.map((i) => i.insumo_id)).toContain(s.bolsa.id);
  });

  it('con "ninguno" ([]), ninguno — antes una lista vacía volvía a la receta', async () => {
    const s = await sembrar();
    await s.ponerAccesorios([]);
    const r = await recetaDe(s.perfume.id, 30);
    expect(r?.items.map((i) => i.insumo_id)).not.toContain(s.bolsa.id);
  });

  it('con una lista propia, esa y no la de la receta', async () => {
    const s = await sembrar();
    await s.ponerAccesorios([s.tarjeta.id]);
    const ids = (await recetaDe(s.perfume.id, 30))?.items.map((i) => i.insumo_id);
    expect(ids).toContain(s.tarjeta.id);
    expect(ids).not.toContain(s.bolsa.id);
  });
});

describe('un lote armado directo', () => {
  beforeEach(limpiarBase);

  it('no cobra la bolsa aunque la pantalla la mande, si la ficha dice "ninguno"', async () => {
    const s = await sembrar();
    await s.ponerAccesorios([]);
    const lote = await conAccesoriosDeFicha(prisma, {
      fecha: '2026-09-27', formula_volumen_id: s.formula.id, perfume_id: s.perfume.id, cantidad: 2,
      consumos: [{ insumo_id: s.frasco.id, cantidad: 2 }, { insumo_id: s.bolsa.id, cantidad: 2 }],
    });
    await registrarProduccion(lote);
    expect(await stock(s.bolsa.id)).toBe(100);
  });

  it('pone la bolsa aunque la pantalla no la mande, si la ficha la hereda', async () => {
    const s = await sembrar();
    const lote = await conAccesoriosDeFicha(prisma, {
      fecha: '2026-09-27', formula_volumen_id: s.formula.id, perfume_id: s.perfume.id, cantidad: 2,
      consumos: [{ insumo_id: s.frasco.id, cantidad: 2 }],
    });
    await registrarProduccion(lote);
    expect(await stock(s.bolsa.id)).toBe(98);
  });
});

describe('corregir los lotes que ya cargaron la bolsa', () => {
  beforeEach(limpiarBase);

  it('devuelve la bolsa, baja el costo del lote y de sus frascos, y no descuenta dos veces', async () => {
    const s = await sembrar();
    // Como antes: el lote cargó la bolsa de la receta…
    const lote = await registrarProduccion({
      fecha: '2026-09-01', formula_volumen_id: s.formula.id, perfume_id: s.perfume.id, cantidad: 2,
      consumos: [{ insumo_id: s.frasco.id, cantidad: 2 }, { insumo_id: s.bolsa.id, cantidad: 2 }],
    });
    // …y después la ficha pasó a "ninguno" (la migración de los 1.1).
    await s.ponerAccesorios([]);
    const antes = await prisma.produccion.findUniqueOrThrow({ where: { id: lote.id } });

    const revision = await revisarAccesoriosSobrantes();
    expect(revision.lotes).toHaveLength(1);
    expect(revision.valor).toBe(600);

    await quitarAccesoriosSobrantes();
    expect(await stock(s.bolsa.id)).toBe(100);
    const despues = await prisma.produccion.findUniqueOrThrow({ where: { id: lote.id } });
    expect(Number(despues.costo_unitario)).toBeCloseTo(Number(antes.costo_unitario) - 300, 2);
    const ficha = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: { perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id } },
    });
    expect(Number(ficha.costo_promedio)).toBeCloseTo(Number(despues.costo_unitario), 2);

    // Otra vez: ya no queda nada, y la bodega no cambia
    expect((await revisarAccesoriosSobrantes()).lotes).toHaveLength(0);
    await quitarAccesoriosSobrantes();
    expect(await stock(s.bolsa.id)).toBe(100);
  });
});

describe('la ficha al guardarse', () => {
  beforeEach(limpiarBase);

  it('un 1.1 nuevo nace sin accesorios; un perfume normal, con los de la receta', async () => {
    const s = await sembrar();
    const base = { precio: 60000, presentaciones: [s.presentacion.id], tipos_aroma: [], ocasiones: [] };
    const once = await createPerfume({ ...base, nombre: 'Eternity 1.1', solo_armado: true } as never);
    const normal = await createPerfume({ ...base, nombre: 'Otro' } as never);
    const leer = (perfume_id: number) => prisma.perfumePresentacion.findUniqueOrThrow({
      where: { perfume_id_presentacion_id: { perfume_id, presentacion_id: s.presentacion.id } },
    });
    expect((await leer(once.id)).accesorios).toEqual([]);
    expect((await leer(normal.id)).accesorios).toBeNull();
  });
});
