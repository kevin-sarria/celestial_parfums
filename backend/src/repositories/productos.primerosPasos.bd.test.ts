import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { primerosPasosProductos } from './productos.primerosPasos.repository';

/**
 * EL PROGRESO SE DEDUCE DE LOS DATOS, NUNCA DE UNA BANDERA.
 *
 * Una bandera "ya lo configuró" miente el día que se importe por Excel o se
 * borre un registro. Aquí cada paso se cuenta contra la base, así que quien ya
 * trabajó nunca ve la lista. Ver la skill `arranque-guiado`.
 */

describe('primeros pasos de Productos', () => {
  beforeEach(limpiarBase);

  it('base sin nada: los tres pasos están pendientes', async () => {
    const p = await primerosPasosProductos();
    expect(p.con_ficha_accesorio).toBe(0);
    expect(p.con_ficha_armado).toBe(0);
    expect(p.productos_publicados).toBe(0);
  });

  it('cuenta los accesorios del inventario que todavía no tienen ficha', async () => {
    await crearInsumo('Perfumero Recargable', { tipo: 'accesorio', precio: 2100, stock: 20 });
    await crearInsumo('Bolsa Organza', { tipo: 'accesorio', precio: 300, stock: 50 });
    expect((await primerosPasosProductos()).accesorios_sin_ficha).toBe(2);
  });

  it('un accesorio deja de contarse en cuanto tiene su ficha', async () => {
    const insumo = await crearInsumo('Perfumero Recargable', { tipo: 'accesorio', precio: 2100, stock: 20 });
    await prisma.perfume.create({
      data: {
        nombre: 'Perfumero Recargable', precio: 5000, publicado: false,
        tipo_producto: 'comprado', es_accesorio: true, insumo_producto_id: insumo.id,
      },
    });
    const p = await primerosPasosProductos();
    expect(p.accesorios_sin_ficha).toBe(0);
    expect(p.con_ficha_accesorio).toBe(1);
  });

  it('un producto sin publicar no marca el paso de la tienda', async () => {
    await prisma.perfume.create({
      data: { nombre: 'Bon Bon 1.1', precio: 150000, solo_armado: true, publicado: false },
    });
    const p = await primerosPasosProductos();
    expect(p.con_ficha_armado).toBe(1);
    expect(p.productos).toBe(1);
    expect(p.productos_publicados).toBe(0);
  });

  it('los perfumes normales publicados NO cuentan como productos publicados', async () => {
    await prisma.perfume.create({
      data: { nombre: 'Khamrah', precio: 95000, tipo_producto: 'fabricado', publicado: true },
    });
    expect((await primerosPasosProductos()).productos_publicados).toBe(0);
  });
});
