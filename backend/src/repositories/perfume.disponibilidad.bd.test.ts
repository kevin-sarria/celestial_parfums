import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { registrarProduccion } from './inventario.repository';
import { selectAllParfums } from './perfume.repository';

/**
 * Las tres reglas de disponibilidad, vistas COMO LAS VE EL CATÁLOGO.
 *
 * La lógica pura ya está cubierta en `perfume.disponibilidad.test.ts`. Esto
 * prueba lo otro, que es donde de verdad se rompe: que la consulta del catálogo
 * TRAIGA los datos que la regla necesita (los frascos armados de cada talla y
 * el stock de la botella del original). Si mañana alguien recorta
 * `perfumeInclude`, la regla seguiría siendo correcta y la tienda mentiría
 * igual — y esta prueba es la única que lo nota.
 */

const FECHA = '2026-08-14';

const catalogo = async (nombre: string) => {
  const { data } = await selectAllParfums(true);
  return data.find((p) => p.nombre === nombre)!;
};

/** Arma `cantidad` frascos de 30 ml del perfume sembrado. */
const armar = async (s: Awaited<ReturnType<typeof sembrarFabricacion30ml>>, cantidad: number) =>
  registrarProduccion({
    fecha: FECHA,
    formula_volumen_id: s.formula.id,
    cantidad,
    perfume_id: s.perfume.id,
    consumos: [
      { insumo_id: s.esencia.id, cantidad: 15 * cantidad },
      { insumo_id: s.diluyente.id, cantidad: 14.3 * cantidad },
      { insumo_id: s.sellador.id, cantidad: 0.4 * cantidad },
      { insumo_id: s.feromonas.id, cantidad: 0.3 * cantidad },
      { insumo_id: s.frasco.id, cantidad: cantidad },
    ],
  });

/** Deja la esencia del perfume en cero: no alcanza para armar ni uno. */
const vaciarEsencia = (esenciaId: number) =>
  prisma.insumoCosto.update({ where: { id: esenciaId }, data: { stock: 0 } });

describe('disponibilidad en el catálogo', () => {
  beforeEach(limpiarBase);

  it('sin esencia y sin frascos armados: agotado (la regla de siempre)', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await vaciarEsencia(s.esencia.id);

    const p = await catalogo('Eternity');

    expect(p.agotado).toBe(true);
    expect(p.motivo_agotado).toBe('sin_esencia');
  });

  it('con frascos armados se vende aunque no quede esencia', async () => {
    // El caso de los 1.1 del dueño: armó los frascos, la esencia ya se gastó.
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 3);
    await vaciarEsencia(s.esencia.id);

    const p = await catalogo('Eternity');

    expect(p.frascos_armados).toBe(3);
    expect(p.agotado).toBe(false);
    expect(p.motivo_agotado).toBe(null);
  });

  it('un 1.1 sin armar está agotado, aunque le sobre esencia y tenga su envase', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await prisma.perfume.update({ where: { id: s.perfume.id }, data: { solo_armado: true } });

    const p = await catalogo('Eternity');

    expect(p.agotado).toBe(true);
    expect(p.motivo_agotado).toBe('sin_armados');
  });

  it('un 1.1 con frascos armados se vende', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await prisma.perfume.update({ where: { id: s.perfume.id }, data: { solo_armado: true } });
    await armar(s, 1);

    const p = await catalogo('Eternity');

    expect(p.agotado).toBe(false);
  });

  it('un original sin stock de su botella sale agotado', async () => {
    // Antes del 2026-08-14 un `comprado` NUNCA se agotaba solo: se podía
    // vender por la tienda una botella que no existe en bodega.
    const botella = await crearInsumo('Sauvage 100 ml original', { tipo: 'envase', precio: 320000 });
    await prisma.perfume.create({
      data: {
        nombre: 'Sauvage original',
        precio: 480000,
        tipo_producto: 'comprado',
        insumo_producto_id: botella.id,
      },
    });

    const p = await catalogo('Sauvage original');

    expect(p.agotado).toBe(true);
    expect(p.motivo_agotado).toBe('sin_producto');
  });

  it('un original con botellas en bodega se vende', async () => {
    const botella = await crearInsumo('Sauvage 100 ml original', {
      tipo: 'envase', precio: 320000, stock: 2,
    });
    await prisma.perfume.create({
      data: {
        nombre: 'Sauvage original',
        precio: 480000,
        tipo_producto: 'comprado',
        insumo_producto_id: botella.id,
      },
    });

    const p = await catalogo('Sauvage original');

    expect(p.agotado).toBe(false);
  });
});
