import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { createPerfume, editPerfume } from './perfume.repository';

/**
 * SOLO UN PERFUME A LA VEZ PUEDE SER "EL REGALO AUTOMÁTICO".
 *
 * Decidido con el dueño el 2026-08-17: el botón "+ Agregar regalo" de
 * Registrar venta busca la ficha marcada con `regalo_automatico`. Si dos
 * fichas pudieran tener la marca a la vez, el botón no sabría cuál ofrecer.
 * Por eso marcar una se la quita a la anterior, tanto al crear como al editar.
 */

const fichaCon = (nombre: string, regalo: boolean) => ({
  nombre,
  precio: 8000,
  tipos_aroma: [],
  ocasiones: [],
  presentaciones: [],
  regalo_automatico: regalo,
});

describe('regalo_automatico: solo una ficha a la vez', () => {
  beforeEach(limpiarBase);

  it('crear una segunda ficha con la marca se la quita a la primera', async () => {
    const a = await createPerfume(fichaCon('Perfumero Recargable', true));
    const b = await createPerfume(fichaCon('Tarjeta personalizada', true));

    const [pa, pb] = await Promise.all([
      prisma.perfume.findUniqueOrThrow({ where: { id: a.id } }),
      prisma.perfume.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(pa.regalo_automatico).toBe(false);
    expect(pb.regalo_automatico).toBe(true);
  });

  it('editar otra ficha para marcarla se la quita a la que la tenía', async () => {
    const a = await createPerfume(fichaCon('Perfumero Recargable', true));
    const b = await createPerfume(fichaCon('Tarjeta personalizada', false));

    await editPerfume(String(b.id), fichaCon('Tarjeta personalizada', true));

    const [pa, pb] = await Promise.all([
      prisma.perfume.findUniqueOrThrow({ where: { id: a.id } }),
      prisma.perfume.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(pa.regalo_automatico).toBe(false);
    expect(pb.regalo_automatico).toBe(true);
  });

  it('editar sin tocar la casilla no se la quita a nadie', async () => {
    const a = await createPerfume(fichaCon('Perfumero Recargable', true));

    await editPerfume(String(a.id), { ...fichaCon('Perfumero Recargable', true), regalo_automatico: undefined });

    const pa = await prisma.perfume.findUniqueOrThrow({ where: { id: a.id } });
    expect(pa.regalo_automatico).toBe(true);
  });
});
