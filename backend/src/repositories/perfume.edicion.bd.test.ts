import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { registrarProduccion } from './inventario.producciones';
import { editPerfume } from './perfume.repository';

/**
 * EDITAR LA FICHA NO PUEDE BORRAR EL INVENTARIO.
 *
 * `editPerfume` rehace los enlaces perfume→talla en cada guardado. Desde que
 * esa tabla lleva también los **frascos armados** y su costo congelado
 * (2026-08-14), rehacerla a lo bruto significa que cambiarle la descripción a
 * un perfume le borra los frascos que hay en la caja. Es plata desapareciendo
 * en silencio, y por eso está probado.
 */

const FECHA = '2026-08-14';

/** Los datos que manda el formulario de edición, con las tallas que se quieran. */
const fichaCon = (nombre: string, presentaciones: number[]) => ({
  nombre,
  precio: 60000,
  tipos_aroma: [],
  ocasiones: [],
  presentaciones,
});

const armados = async (perfumeId: number, presentacionId: number) => {
  const f = await prisma.perfumePresentacion.findUnique({
    where: { perfume_id_presentacion_id: { perfume_id: perfumeId, presentacion_id: presentacionId } },
  });
  return { stock: Number(f?.stock ?? 0), costo: Number(f?.costo_promedio ?? 0) };
};

const armar = (s: Awaited<ReturnType<typeof sembrarFabricacion30ml>>, cantidad: number) =>
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

describe('editar un perfume con frascos ya armados', () => {
  beforeEach(limpiarBase);

  it('guardar la ficha conserva los frascos armados y su costo', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 7);
    const antes = await armados(s.perfume.id, s.presentacion.id);

    await editPerfume(String(s.perfume.id), fichaCon('Eternity renombrado', [s.presentacion.id]));

    const despues = await armados(s.perfume.id, s.presentacion.id);
    expect(despues.stock).toBe(7);
    expect(despues.costo).toBeCloseTo(antes.costo, 4);
  });

  it('quitarle una talla que todavía tiene frascos armados se rechaza', async () => {
    // Dejarlo pasar borraría el rastro de 7 frascos que están físicamente en la
    // caja. Primero se venden o se ajustan; después se quita la talla.
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 7);

    await expect(editPerfume(String(s.perfume.id), fichaCon('Eternity', [])))
      .rejects.toThrow(/frascos armados/i);

    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(7);
  });

  it('quitarle una talla vacía sigue siendo normal', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await prisma.perfumePresentacion.create({
      data: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id },
    });

    await editPerfume(String(s.perfume.id), fichaCon('Eternity', []));

    const filas = await prisma.perfumePresentacion.count({ where: { perfume_id: s.perfume.id } });
    expect(filas).toBe(0);
  });
});
