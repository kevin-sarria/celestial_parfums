import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { selectParfumsPaginated } from './perfume.repository';

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
});
