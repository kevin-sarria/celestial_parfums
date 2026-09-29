import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { selectParfumsPaginated } from './perfume.repository';

/**
 * LA TIENDA SE PARTE EN FRAGANCIAS Y ACCESORIOS (2026-09-28, Ola 3).
 *
 * `/perfumes` muestra fragancias —los 1.1 incluidos, son perfume— y
 * `/accesorios` el perfumero, la bolsa, la tarjeta. El dashboard (`todos`)
 * no se parte así: allá manda la familia.
 */
const nombres = (r: { data: { nombre: string }[] }) => r.data.map((p) => p.nombre).sort();

describe('las dos secciones de la tienda', () => {
  beforeEach(async () => {
    await limpiarBase();
    await prisma.perfume.createMany({
      data: [
        { nombre: 'Khamrah', precio: 60000, publicado: true },
        { nombre: 'Khamrah 1.1', precio: 180000, publicado: true, solo_armado: true },
        { nombre: 'Perfumero', precio: 5000, publicado: true, tipo_producto: 'comprado', es_accesorio: true },
        { nombre: 'Bolsa oculta', precio: 2000, publicado: false, tipo_producto: 'comprado', es_accesorio: true },
      ],
    });
  });

  it('/perfumes trae las fragancias, 1.1 incluido, y ningún accesorio', async () => {
    expect(nombres(await selectParfumsPaginated(1, 24))).toEqual(['Khamrah', 'Khamrah 1.1']);
  });

  it('/accesorios trae solo los accesorios publicados', async () => {
    expect(nombres(await selectParfumsPaginated(1, 24, undefined, { seccion: 'accesorios' }))).toEqual(['Perfumero']);
  });

  it('el dashboard sigue viendo todo', async () => {
    expect(nombres(await selectParfumsPaginated(1, 24, undefined, undefined, true))).toHaveLength(4);
  });
});
