import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { estadoDe, limpiarBase } from '../test/baseDePrueba';
import { crearInsumo } from './costeo.repository';
import { createPago } from './pago.repository';
import { patchPublicadoPerfume } from './perfume.repository';

/**
 * LOS PERFUMES ORIGINALES (dueño, 2026-09-29).
 *
 * Compró 15 originales y el sistema no tenía cómo recibirlos: el modal de
 * material nuevo solo conocía esencias, envases y accesorios. Se decidió la
 * opción A: UNA ficha por original, que vende decants de 3, 5 y 10 ml y la
 * botella completa, todo del mismo stock en ml. Nace sin precios y fuera de la
 * tienda; el dueño los pone y la publica.
 */

const botellaOriginal = (nombre: string, extra: Record<string, unknown> = {}) => ({
  nombre,
  tipo: 'materia_prima' as const,
  unidad: 'ml' as const,
  alcance: 'unidad' as const,
  precio: 0,
  ml_botella: 100,
  crear_perfume: true,
  ...extra,
});

const tallasDe = async (perfumeId: number) =>
  (await prisma.perfumePresentacion.findMany({ where: { perfume_id: perfumeId }, include: { presentacion: true } }))
    .map((t) => t.presentacion.ml).sort((a, b) => (a ?? 0) - (b ?? 0));

describe('un original que llega en una compra', () => {
  beforeEach(async () => { await limpiarBase(); });

  it('nace como ficha Original con sus decants y la botella completa, sin precio y oculta', async () => {
    const res = await crearInsumo(botellaOriginal('Khamrah – Original 100 ml', { perfume_nombre: 'Khamrah Original' }));

    expect(res.perfume?.accion).toBe('creado');
    const p = await prisma.perfume.findUniqueOrThrow({ where: { id: res.perfume!.id }, include: { categoria: true } });
    expect(p.tipo_producto).toBe('fraccionado');
    expect(p.insumo_producto_id).toBe(res.id);
    expect(p.categoria?.nombre).toBe('Original');
    expect(p.publicado).toBe(false);
    expect(Number(p.precio)).toBe(0);
    expect(await tallasDe(p.id)).toEqual([3, 5, 10, 100]);
    expect(res.ml_botella).toBe(100);
  });

  it('si ya lo vendías en contratipo, copia su ficha: foto, notas y descripción', async () => {
    const aroma = await prisma.tipoAroma.create({ data: { nombre: 'Dulce' } });
    const contratipo = await prisma.perfume.create({
      data: {
        nombre: 'Khamrah', precio: 60000, descripcion: 'Dátil y canela', imagen_url: '/uploads/khamrah.webp',
        genero: 'unisex', tipos_aroma: { create: [{ tipo_aroma_id: aroma.id }] },
      },
    });

    const res = await crearInsumo(botellaOriginal('Khamrah – Original 100 ml', {
      perfume_nombre: 'Khamrah Original', copiar_de_perfume_id: contratipo.id,
    }));

    const p = await prisma.perfume.findUniqueOrThrow({ where: { id: res.perfume!.id }, include: { tipos_aroma: true } });
    expect(p.descripcion).toBe('Dátil y canela');
    expect(p.imagen_url).toBe('/uploads/khamrah.webp');
    expect(p.genero).toBe('unisex');
    expect(p.tipos_aroma.map((t) => t.tipo_aroma_id)).toEqual([aroma.id]);
    // Lo que NO se copia: el precio y el tipo siguen siendo los del original
    expect(Number(p.precio)).toBe(0);
    expect(p.tipo_producto).toBe('fraccionado');
  });

  it('no pisa un producto que ya se llama igual', async () => {
    await prisma.perfume.create({ data: { nombre: 'Khamrah Original', precio: 1 } });
    const res = await crearInsumo(botellaOriginal('Khamrah – Original 100 ml', { perfume_nombre: 'Khamrah Original' }));
    expect(res.perfume?.accion).toBe('ya_existe');
    expect(await prisma.perfume.count()).toBe(1);
  });

  it('una botella original se lleva en ml: por piezas no se podría partir en decants', async () => {
    await expect(import('../schemas/cotizacion.schema').then(({ insumoSchema }) =>
      insumoSchema.parse(botellaOriginal('X', { unidad: 'unidad' })))).rejects.toThrow();
  });
});

describe('comprar originales por botella', () => {
  beforeEach(async () => { await limpiarBase(); });

  const comprar = async (insumoId: number, cantidad: number, subtotal: number) => {
    const empresa = await prisma.empresa.create({ data: { nombre: 'Proveedor', iva_modo: 'sin_iva' } });
    return createPago({
      dia: '2026-09-29', empresa_id: empresa.id, valor_compra: subtotal,
      items: [{ insumo_id: insumoId, cantidad, unidad_compra: 'botella', subtotal }],
    }, 'http://localhost');
  };

  it('"2 botellas" de 100 ml entran como 200 ml, y el costo queda por ml', async () => {
    const res = await crearInsumo(botellaOriginal('Khamrah – Original 100 ml'));
    await comprar(res.id, 2, 400000);

    const estado = await estadoDe(res.id);
    expect(estado.stock).toBe(200);
    expect(estado.promedio).toBe(2000); // 400.000 ÷ 200 ml
  });

  it('en botellas solo se compra lo que ES una botella', async () => {
    const alcohol = await prisma.insumoCosto.create({
      data: { nombre: 'Alcohol', tipo: 'materia_prima', unidad: 'ml', precio: 0 },
    });
    await expect(comprar(alcohol.id, 1, 1000)).rejects.toThrow(/no es una botella/);
  });
});

describe('publicar un original', () => {
  beforeEach(async () => { await limpiarBase(); });

  it('no deja publicarlo mientras una talla esté en $0, y sí cuando todas tienen precio', async () => {
    const res = await crearInsumo(botellaOriginal('Khamrah – Original 100 ml', { perfume_nombre: 'Khamrah Original' }));
    const id = res.perfume!.id;

    await expect(patchPublicadoPerfume(String(id), true)).rejects.toThrow(/Ponle precio a/);

    await prisma.perfumePresentacion.updateMany({ where: { perfume_id: id }, data: { precio: 25000 } });
    await patchPublicadoPerfume(String(id), true);
    expect((await prisma.perfume.findUniqueOrThrow({ where: { id } })).publicado).toBe(true);
  });

  it('sacarlo de la tienda nunca se bloquea', async () => {
    const p = await prisma.perfume.create({ data: { nombre: 'Sin precio', precio: 0 } });
    await patchPublicadoPerfume(String(p.id), false);
    expect((await prisma.perfume.findUniqueOrThrow({ where: { id: p.id } })).publicado).toBe(false);
  });
});
