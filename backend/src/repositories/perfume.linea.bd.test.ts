import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { createPerfume, selectParfumsPaginated } from './perfume.repository';
import { exportarCatalogo } from '../services/import/catalogo';
import { lineaDeCatalogo, naceApagado, type LineaCatalogo } from './perfume.linea';

/**
 * CUATRO VISTAS DE LA MISMA TABLA (2026-10-04, proyecto 3 del rediseño).
 *
 * El panel parte el catálogo por LÍNEA: Contratipos · 1.1 · Originales ·
 * Productos y accesorios. La regla la evalúa el sistema solo (`lineaDe` en
 * perfume.mapeo.ts); si se rompe, una ficha se esconde de todas las pestañas
 * sin avisar. Ver docs/superpowers/specs/2026-10-04-catalogo-por-linea-design.md
 */

const nombres = async (linea?: LineaCatalogo) => {
  const r = await selectParfumsPaginated(1, 50, undefined, undefined, true, undefined, linea);
  return r.data.map((p) => p.nombre).sort();
};

describe('línea del catálogo', () => {
  beforeEach(async () => {
    await limpiarBase();
    await prisma.perfume.createMany({
      data: [
        { nombre: 'Contratipo', precio: 60000, tipo_producto: 'fabricado', solo_armado: false },
        { nombre: 'Armado 1.1', precio: 120000, tipo_producto: 'fabricado', solo_armado: true },
        { nombre: 'Splash comprado', precio: 45000, tipo_producto: 'comprado', solo_armado: false },
        { nombre: 'Perfumero', precio: 5000, tipo_producto: 'comprado', es_accesorio: true },
        { nombre: 'Original', precio: 200000, tipo_producto: 'fraccionado', solo_armado: false },
      ],
    });
  });

  it('contratipos trae solo lo que se fabrica contra pedido', async () => {
    expect(await nombres('contratipo')).toEqual(['Contratipo']);
  });

  it('1.1 trae solo los que se arman por adelantado', async () => {
    expect(await nombres('uno_uno')).toEqual(['Armado 1.1']);
  });

  it('originales trae los fraccionados (botella + decants)', async () => {
    expect(await nombres('original')).toEqual(['Original']);
  });

  it('productos trae comprados y accesorios', async () => {
    expect(await nombres('producto')).toEqual(['Perfumero', 'Splash comprado']);
  });

  it('sin línea no se filtra nada: la venta y la tienda siguen viéndolo todo', async () => {
    expect(await nombres()).toHaveLength(5);
  });

  it('las cuatro líneas juntas son el catálogo entero: nada se pierde por el camino', async () => {
    const partes = [
      ...(await nombres('contratipo')),
      ...(await nombres('uno_uno')),
      ...(await nombres('original')),
      ...(await nombres('producto')),
    ].sort();
    expect(partes).toEqual(await nombres());
  });

  it('un accesorio marcado solo_armado va a productos, no a 1.1 (el orden de lineaDe manda)', async () => {
    await prisma.perfume.create({
      data: { nombre: 'Accesorio raro', precio: 3000, tipo_producto: 'comprado', solo_armado: true, es_accesorio: true },
    });
    expect(await nombres('producto')).toContain('Accesorio raro');
    expect(await nombres('uno_uno')).not.toContain('Accesorio raro');
  });
});

describe('naceApagado y lineaDeCatalogo (puro)', () => {
  it('naceApagado cubre 1.1, comprado y fraccionado; el contratipo no', () => {
    expect(naceApagado({ tipo_producto: 'fabricado' })).toBe(false);
    expect(naceApagado({ solo_armado: true })).toBe(true);
    expect(naceApagado({ tipo_producto: 'comprado' })).toBe(true);
    expect(naceApagado({ tipo_producto: 'fraccionado' })).toBe(true);
  });

  it('lineaDeCatalogo colapsa accesorio y comprado en producto', () => {
    expect(lineaDeCatalogo({ tipo_producto: 'fabricado' })).toBe('contratipo');
    expect(lineaDeCatalogo({ solo_armado: true })).toBe('uno_uno');
    expect(lineaDeCatalogo({ tipo_producto: 'fraccionado' })).toBe('original');
    expect(lineaDeCatalogo({ tipo_producto: 'comprado' })).toBe('producto');
    expect(lineaDeCatalogo({ tipo_producto: 'comprado', es_accesorio: true })).toBe('producto');
  });
});

/**
 * LA MISMA PREGUNTA, APLICADA A UNA FICHA QUE NACE.
 *
 * Un contratipo nace publicado; un 1.1, un comprado o un original nace a medio
 * llenar y debe completarse antes de enseñarse.
 */
describe('publicado al nacer (naceApagado)', () => {
  beforeEach(limpiarBase);

  const base = { precio: 60000, tipos_aroma: [], ocasiones: [], presentaciones: [] };

  const publicadoDe = async (id: number) => {
    const p = await prisma.perfume.findUniqueOrThrow({ where: { id }, select: { publicado: true } });
    return p.publicado;
  };

  it('un contratipo nace publicado', async () => {
    const { id } = await createPerfume({ ...base, nombre: 'Eternity', tipo_producto: 'fabricado' });
    expect(await publicadoDe(id)).toBe(true);
  });

  it('un comprado nace sin publicar', async () => {
    const { id } = await createPerfume({ ...base, nombre: 'Splash comprado', tipo_producto: 'comprado' });
    expect(await publicadoDe(id)).toBe(false);
  });

  it('un solo_armado (1.1) nace sin publicar', async () => {
    const { id } = await createPerfume({ ...base, nombre: 'Bon Bon 1.1', tipo_producto: 'fabricado', solo_armado: true });
    expect(await publicadoDe(id)).toBe(false);
  });

  it('un `publicado` explícito sigue mandando sobre la regla', async () => {
    const { id } = await createPerfume({ ...base, nombre: 'Perfumero forzado', tipo_producto: 'comprado', publicado: true });
    expect(await publicadoDe(id)).toBe(true);
  });
});

/**
 * LA MISMA REGLA, EN LA DESCARGA DE EXCEL.
 *
 * El botón Exportar de cada pestaña trae lo que esa pestaña enseña, y el
 * archivo se llama distinto por línea para no confundirlos.
 */
describe('exportar a Excel respeta la línea', () => {
  beforeEach(async () => {
    await limpiarBase();
    await prisma.perfume.createMany({
      data: [
        { nombre: 'Contratipo', precio: 60000, tipo_producto: 'fabricado', solo_armado: false },
        { nombre: 'Armado 1.1', precio: 120000, tipo_producto: 'fabricado', solo_armado: true },
        { nombre: 'Splash comprado', precio: 45000, tipo_producto: 'comprado', solo_armado: false },
      ],
    });
  });

  const exportados = async (linea?: LineaCatalogo) =>
    ((await exportarCatalogo('perfumes', linea)) ?? []).map((f) => f.nombre).sort();

  it('desde 1.1 baja solo lo armado', async () => {
    expect(await exportados('uno_uno')).toEqual(['Armado 1.1']);
  });

  it('desde productos baja los comprados', async () => {
    expect(await exportados('producto')).toEqual(['Splash comprado']);
  });

  it('sin línea sigue bajando el catálogo entero (respaldos, plantillas)', async () => {
    expect(await exportados()).toHaveLength(3);
  });
});
