import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { createPerfume, selectParfumsPaginated } from './perfume.repository';
import { exportarCatalogo } from '../services/import/catalogo';

/**
 * DOS VISTAS DE LA MISMA TABLA.
 *
 * El dashboard parte el catálogo por una regla que el sistema evalúa solo:
 * ¿existe antes de venderse (Productos) o se fabrica al venderlo (Perfumes)?
 * Si la regla se rompe, un 1.1 se esconde de las dos listas y desaparece sin
 * que nadie se entere. Ver docs/superpowers/specs/2026-08-23-productos-y-accesorios-design.md
 */

const nombres = async (familia?: 'fabricadas' | 'productos') => {
  const r = await selectParfumsPaginated(1, 50, undefined, undefined, true, undefined, familia);
  return r.data.map((p) => p.nombre).sort();
};

describe('familia de producto', () => {
  beforeEach(async () => {
    await limpiarBase();
    await prisma.perfume.createMany({
      data: [
        { nombre: 'Fabricado normal', precio: 60000, tipo_producto: 'fabricado', solo_armado: false },
        { nombre: 'Armado 1.1', precio: 120000, tipo_producto: 'fabricado', solo_armado: true },
        { nombre: 'Splash comprado', precio: 45000, tipo_producto: 'comprado', solo_armado: false },
        { nombre: 'Perfumero', precio: 5000, tipo_producto: 'comprado', es_accesorio: true },
      ],
    });
  });

  it('Perfumes solo trae lo que se fabrica al vender', async () => {
    expect(await nombres('fabricadas')).toEqual(['Fabricado normal']);
  });

  it('Productos trae los 1.1, los comprados y los accesorios', async () => {
    expect(await nombres('productos')).toEqual(['Armado 1.1', 'Perfumero', 'Splash comprado']);
  });

  it('sin familia no se filtra nada: la venta y la tienda siguen viéndolo todo', async () => {
    expect(await nombres()).toHaveLength(4);
  });

  it('las dos familias juntas son el catálogo entero: nada se pierde por el camino', async () => {
    const partes = [...(await nombres('fabricadas')), ...(await nombres('productos'))].sort();
    expect(partes).toEqual(await nombres());
  });

  it('un decant va con los perfumes: no existe hasta que alguien lo compra', async () => {
    await prisma.perfume.create({
      data: { nombre: 'Decant 10 ml', precio: 20000, tipo_producto: 'fraccionado' },
    });
    expect(await nombres('fabricadas')).toContain('Decant 10 ml');
    expect(await nombres('productos')).not.toContain('Decant 10 ml');
  });

  it('ningún tipo de producto se queda fuera de las dos familias', async () => {
    await prisma.perfume.create({
      data: { nombre: 'Decant 10 ml', precio: 20000, tipo_producto: 'fraccionado' },
    });
    const partes = [...(await nombres('fabricadas')), ...(await nombres('productos'))].sort();
    expect(partes).toEqual(await nombres());
  });
});

/**
 * LA MISMA PREGUNTA, APLICADA A UNA FICHA QUE NACE.
 *
 * Un producto (1.1, comprado, accesorio) nace apagado: la ficha se llena
 * después y nadie debe ver una a medio llenar en la tienda. Un fabricado
 * sigue naciendo publicado, como siempre — Hallazgo 2 de la revisión final
 * de la Ola 1 de Productos (2026-08-23).
 */
describe('publicado al nacer (naceComoProducto)', () => {
  beforeEach(limpiarBase);

  const base = { precio: 60000, tipos_aroma: [], ocasiones: [], presentaciones: [] };

  const publicadoDe = async (id: number) => {
    const p = await prisma.perfume.findUniqueOrThrow({ where: { id }, select: { publicado: true } });
    return p.publicado;
  };

  it('un fabricado nace publicado', async () => {
    const { id } = await createPerfume({ ...base, nombre: 'Eternity', tipo_producto: 'fabricado' });
    expect(await publicadoDe(id)).toBe(true);
  });

  it('un comprado nace sin publicar', async () => {
    const { id } = await createPerfume({ ...base, nombre: 'Splash comprado', tipo_producto: 'comprado' });
    expect(await publicadoDe(id)).toBe(false);
  });

  it('un solo_armado (1.1) nace sin publicar', async () => {
    const { id } = await createPerfume({
      ...base, nombre: 'Bon Bon 1.1', tipo_producto: 'fabricado', solo_armado: true,
    });
    expect(await publicadoDe(id)).toBe(false);
  });

  it('un `publicado` explícito sigue mandando sobre la regla', async () => {
    const { id } = await createPerfume({
      ...base, nombre: 'Perfumero forzado', tipo_producto: 'comprado', publicado: true,
    });
    expect(await publicadoDe(id)).toBe(true);
  });
});

/**
 * LA MISMA REGLA, EN LA DESCARGA DE EXCEL.
 *
 * El botón Exportar de cada pestaña tiene que traer lo que esa pestaña enseña.
 * Antes traía la tabla entera: desde Productos —una pestaña de 4 filas— se
 * descargaban los 222 perfumes del dueño, y el archivo no servía para nada.
 * Hallazgo 3 de la revisión final de la Ola 1 (2026-08-23).
 */
describe('exportar a Excel respeta la familia', () => {
  beforeEach(async () => {
    await limpiarBase();
    await prisma.perfume.createMany({
      data: [
        { nombre: 'Fabricado normal', precio: 60000, tipo_producto: 'fabricado', solo_armado: false },
        { nombre: 'Armado 1.1', precio: 120000, tipo_producto: 'fabricado', solo_armado: true },
        { nombre: 'Splash comprado', precio: 45000, tipo_producto: 'comprado', solo_armado: false },
      ],
    });
  });

  const exportados = async (familia?: 'fabricadas' | 'productos') =>
    ((await exportarCatalogo('perfumes', familia)) ?? []).map(f => f.nombre).sort();

  it('desde Productos baja solo lo que se ve en Productos', async () => {
    expect(await exportados('productos')).toEqual(['Armado 1.1', 'Splash comprado']);
  });

  it('desde Perfumes baja solo las fragancias', async () => {
    expect(await exportados('fabricadas')).toEqual(['Fabricado normal']);
  });

  it('sin familia sigue bajando el catálogo entero (respaldos, plantillas)', async () => {
    expect(await exportados()).toHaveLength(3);
  });
});
