import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { quitarAccesoriosSobrantes, revisarAccesoriosSobrantes } from '../repositories/accesoriosSobrantes';
import { recetaDe } from '../repositories/inventario.consumoVenta';
import { registrarProduccion } from '../repositories/inventario.producciones';
import { createVenta } from '../repositories/venta.repository';
import { empaqueParaPedido, guardarEmpaqueDeLinea } from './empaque.repository';
import { sinEmpaque } from './sinEmpaque';

/**
 * EL EMPAQUE SALE AL VENDER, A LA VISTA (dueño, 2026-10-04).
 *
 * La bolsa y el perfumero ya no van por debajo en la receta ni en los lotes:
 * son productos accesorio que la venta regala según la línea y la talla, o
 * según el kit del combo. Diseño en
 * `docs/superpowers/specs/2026-10-04-empaque-por-linea-design.md`.
 */

const sembrar = async () => {
  const s = await sembrarFabricacion30ml();
  const bolsaInsumo = await crearInsumo('Bolsa Organza', { tipo: 'accesorio', precio: 300, stock: 100 });
  const bolsa = await prisma.perfume.create({
    data: { nombre: 'Bolsa Organza', precio: 0, tipo_producto: 'comprado', es_accesorio: true, publicado: false, insumo_producto_id: bolsaInsumo.id },
  });
  await prisma.perfumePresentacion.create({ data: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id } });
  await guardarEmpaqueDeLinea('contratipo', [{ presentacion_id: s.presentacion.id, perfume_id: bolsa.id, cantidad: 1 }]);
  return { ...s, bolsaInsumo, bolsa };
};

const stock = async (id: number) => Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id } })).stock);

describe('el empaque de un pedido', () => {
  beforeEach(limpiarBase);

  it('un contratipo de 30 ml lleva la bolsa de su línea, una por unidad', async () => {
    const s = await sembrar();
    const r = await empaqueParaPedido([{ perfume_id: s.perfume.id, ml: 30, cantidad: 2, regalo: 0 }]);
    expect(Object.fromEntries(r)).toEqual({ [s.bolsa.id]: 2 });
  });

  it('un 1.1 no lleva lo del contratipo', async () => {
    const s = await sembrar();
    await prisma.perfume.update({ where: { id: s.perfume.id }, data: { solo_armado: true } });
    expect((await empaqueParaPedido([{ perfume_id: s.perfume.id, ml: 30, cantidad: 1, regalo: 0 }])).size).toBe(0);
  });

  it('lo regalado no lleva empaque (no se cobra, no se empaca aparte)', async () => {
    const s = await sembrar();
    const r = await empaqueParaPedido([{ perfume_id: s.perfume.id, ml: 30, cantidad: 3, regalo: 1 }]);
    expect(r.get(s.bolsa.id)).toBe(2);
  });

  it('solo acepta accesorios como empaque', async () => {
    const s = await sembrar();
    await expect(guardarEmpaqueDeLinea('contratipo', [{ presentacion_id: s.presentacion.id, perfume_id: s.perfume.id, cantidad: 1 }]))
      .rejects.toThrow(/accesorios/);
  });
});

describe('el inventario', () => {
  beforeEach(limpiarBase);

  it('vender un contratipo ya no descuenta la bolsa por debajo: la descuenta su línea de regalo, una vez', async () => {
    const s = await sembrar();
    const receta = await recetaDe(s.perfume.id, 30);
    expect(receta?.items.map((i) => i.insumo_id)).not.toContain(s.bolsaInsumo.id);

    await createVenta({
      dia: '2026-10-04', persona: 'Cliente', cantidad_perfumes: 1, valor_venta: 60000, pagada: true,
      lineas: [
        { perfume_id: s.perfume.id, ml: 30, cantidad: 1, regalo: 0 },
        { perfume_id: s.bolsa.id, ml: null, cantidad: 1, regalo: 1 },
      ],
    } as never);
    expect(await stock(s.bolsaInsumo.id)).toBe(99);
  });

  it('armar un lote no gasta empaque, aunque la pantalla vieja lo mande', async () => {
    const s = await sembrar();
    const lote = await sinEmpaque(prisma, {
      fecha: '2026-10-04', formula_volumen_id: s.formula.id, perfume_id: s.perfume.id, cantidad: 2,
      envase_insumo_id: s.frasco.id,
      consumos: [{ insumo_id: s.frasco.id, cantidad: 2 }, { insumo_id: s.bolsaInsumo.id, cantidad: 2 }],
    });
    await registrarProduccion(lote);
    expect(await stock(s.bolsaInsumo.id)).toBe(100);
    expect(await stock(s.frasco.id)).toBe(998);
  });
});

describe('corregir los lotes viejos que cargaron empaque', () => {
  beforeEach(limpiarBase);

  it('un lote de 1.1 que cargó la bolsa se corrige; el de un contratipo se respeta (era la regla de su día)', async () => {
    const s = await sembrar();
    const once = await prisma.perfume.create({ data: { nombre: 'Eternity 1.1', precio: 90000, solo_armado: true, insumo_esencia_id: s.esencia.id } });
    const consumos = [{ insumo_id: s.frasco.id, cantidad: 1 }, { insumo_id: s.bolsaInsumo.id, cantidad: 1 }];
    // Como antes del cambio: los dos lotes cargaron la bolsa de la receta
    await registrarProduccion({ fecha: '2026-09-01', formula_volumen_id: s.formula.id, perfume_id: once.id, cantidad: 1, consumos });
    await registrarProduccion({ fecha: '2026-09-01', formula_volumen_id: s.formula.id, perfume_id: s.perfume.id, cantidad: 1, consumos });
    expect(await stock(s.bolsaInsumo.id)).toBe(98);

    const revision = await revisarAccesoriosSobrantes();
    expect(revision.lotes.map((l) => l.ficha)).toEqual(['Eternity 1.1']);

    await quitarAccesoriosSobrantes();
    expect(await stock(s.bolsaInsumo.id)).toBe(99);
    expect((await revisarAccesoriosSobrantes()).lotes).toHaveLength(0);
  });
});
