import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { findPerfumeBySlug } from '../repositories/perfume.repository';
import { guardarEmpaqueDeLinea } from '../empaque/empaque.repository';
import { aplicarPrecios, costosDeFicha, listarOriginales, ponerMeta } from './preciosOriginales.repository';

/**
 * PRECIOS DE LOS ORIGINALES (dueño, 2026-10-04): el costo de cada talla es el
 * mismo que descuenta la venta, y ponerle precio a un decant lo saca a la tienda.
 */

const sembrar = async () => {
  // Botella de 100 ml que costó $200.000: $2.000 el ml
  const botella = await crearInsumo('Khamrah – Botella original', { unidad: 'ml', precio: 2000, stock: 100 });
  await prisma.insumoCosto.update({ where: { id: botella.id }, data: { ml_botella: 100 } });
  const frasco = await crearInsumo('Frasco decant 5 ml', { tipo: 'envase', precio: 1500, stock: 50 });
  const formula = await prisma.formulaVolumen.create({ data: { nombre: '5 ml', ml_total: 5, esencia_ml: 0, envase_insumo_id: frasco.id } });
  const t5 = await prisma.presentacion.create({ data: { nombre: '5ML', ml: 5, formula_volumen_id: formula.id } });
  const t100 = await prisma.presentacion.create({ data: { nombre: '100ML', ml: 100 } });
  const original = await prisma.perfume.create({
    data: { nombre: 'Khamrah Original', precio: 270000, tipo_producto: 'fraccionado', insumo_producto_id: botella.id, publicado: true },
  });
  await prisma.perfumePresentacion.createMany({ data: [
    { perfume_id: original.id, presentacion_id: t5.id },
    { perfume_id: original.id, presentacion_id: t100.id },
  ] });
  // El decant se entrega en una bolsa de $300
  const bolsaInsumo = await crearInsumo('Bolsa', { tipo: 'accesorio', precio: 300, stock: 50 });
  const bolsa = await prisma.perfume.create({
    data: { nombre: 'Bolsa', precio: 0, tipo_producto: 'comprado', es_accesorio: true, insumo_producto_id: bolsaInsumo.id },
  });
  await guardarEmpaqueDeLinea('decant', [{ presentacion_id: t5.id, perfume_id: bolsa.id, cantidad: 1 }]);
  return { original, t5, t100, botella };
};

describe('los precios de los originales', () => {
  beforeEach(limpiarBase);

  it('el decant cuesta su líquido + 2 ml de merma + su frasco + su empaque; la botella, solo el líquido', async () => {
    const { t5, t100 } = await sembrar();
    const [k] = await listarOriginales();
    const decant = k.tallas.find((t) => t.presentacion_id === t5.id)!;
    const entera = k.tallas.find((t) => t.presentacion_id === t100.id)!;
    expect(decant.costo).toEqual({ liquido: 10000, merma: 4000, frasco: 1500, empaque: 300, total: 15800 });
    expect(decant.precio).toBe(0); // sin precio: escondido de la tienda
    expect(entera.costo?.total).toBe(200000);
    expect(entera.precio).toBe(270000); // la botella hereda el precio general
  });

  it('ponerle precio al decant lo saca a la tienda', async () => {
    const { original, t5 } = await sembrar();
    const antes = await findPerfumeBySlug('khamrah-original');
    expect(antes?.precios.map((t) => t.presentacion)).toEqual(['100ML']);

    expect(await aplicarPrecios([{ perfume_id: original.id, presentacion_id: t5.id, precio: 23000 }])).toBe(1);
    const despues = await findPerfumeBySlug('khamrah-original');
    expect(despues?.precios.map((t) => [t.presentacion, t.precio])).toEqual([['5ML', 23000], ['100ML', 270000]]);
  });

  it('la meta propia se guarda y se quita; solo en originales y con un porcentaje que tenga sentido', async () => {
    const { original } = await sembrar();
    await ponerMeta(original.id, { tipo: 'pesos', valor: 10000 });
    expect((await listarOriginales())[0].meta).toEqual({ tipo: 'pesos', valor: 10000 });
    await ponerMeta(original.id, null);
    expect((await listarOriginales())[0].meta).toBeNull();
    await expect(ponerMeta(original.id, { tipo: 'porcentaje', valor: 120 })).rejects.toThrow(/1 a 90/);
  });

  it('la ficha del perfume da el MISMO costo que la lista (una sola cuenta)', async () => {
    const { t5, t100, botella } = await sembrar();
    const ficha = await costosDeFicha(botella.id, [
      { presentacion_id: t5.id, envase_insumo_id: null },
      { presentacion_id: t100.id, envase_insumo_id: null },
    ]);
    const [lista] = await listarOriginales();
    for (const f of ficha) {
      expect(f.costo).toEqual(lista.tallas.find((t) => t.presentacion_id === f.presentacion_id)?.costo);
    }
    expect(ficha.find((f) => f.presentacion_id === t5.id)?.costo?.total).toBe(15800);
  });
});
