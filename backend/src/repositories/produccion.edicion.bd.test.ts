import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { editarProduccion, registrarProduccion } from './inventario.producciones';

/**
 * EDITAR UN LOTE.
 *
 * Hasta el 2026-08-25 no existía a propósito: mover frascos entre fichas a mano
 * es justo donde se descuadran los costos. Ese "a propósito" ya costaba plata —
 * el lote 6 de Khamrah tenía un frasco de $74.580 colgado de la ficha del
 * perfume corriente, y el único arreglo era borrarlo y volver a escribirlo, que
 * además recalculaba el costo al promedio de hoy.
 *
 * Editar es deshacer y rehacer dentro de una sola transacción: o pasan las
 * cuatro cosas (devolver material, quitar frascos, volver a descontar, volver a
 * sumar) o no pasa ninguna.
 */

const FECHA = '2026-08-21';

const consumosDe = (s: Awaited<ReturnType<typeof sembrarFabricacion30ml>>, cantidad: number) => [
  { insumo_id: s.esencia.id, cantidad: 15 * cantidad },
  { insumo_id: s.diluyente.id, cantidad: 14.3 * cantidad },
  { insumo_id: s.frasco.id, cantidad },
];

const armar = (s: Awaited<ReturnType<typeof sembrarFabricacion30ml>>, cantidad: number) =>
  registrarProduccion({
    fecha: FECHA, formula_volumen_id: s.formula.id, cantidad,
    perfume_id: s.perfume.id, consumos: consumosDe(s, cantidad),
  });

const armados = async (perfume_id: number, presentacion_id: number) => {
  const f = await prisma.perfumePresentacion.findUnique({
    where: { perfume_id_presentacion_id: { perfume_id, presentacion_id } },
  });
  return { stock: Number(f?.stock ?? 0), costo: Number(f?.costo_promedio ?? 0) };
};

describe('editar un lote', () => {
  beforeEach(limpiarBase);

  it('deja la esencia como si el lote se hubiera registrado bien desde el principio', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 2);

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 5,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 5),
    });

    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 15 * 5);
    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(5);
  });

  it('cambiar de ficha muda los frascos con su costo y no toca ni un ml de esencia', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const uno = await prisma.perfume.create({
      data: { nombre: 'Khamrah 1.1', precio: 150000, solo_armado: true },
    });
    const lote = await armar(s, 2);
    const esenciaTrasArmar = (await estadoDe(s.esencia.id)).stock;
    const costoOriginal = (await armados(s.perfume.id, s.presentacion.id)).costo;

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 2,
      perfume_id: uno.id, consumos: consumosDe(s, 2),
      costo_unitario: costoOriginal, costo_manual: false,
    });

    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaTrasArmar);
    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(0);
    const destino = await armados(uno.id, s.presentacion.id);
    expect(destino.stock).toBe(2);
    expect(destino.costo).toBeCloseTo(costoOriginal, 2);
  });

  it('el costo escrito a mano manda sobre el calculado y queda marcado', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 1);

    const editado = await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 1), costo_unitario: 74580,
    });

    expect(Number(editado.costo_unitario)).toBe(74580);
    expect(Number(editado.costo_total)).toBe(74580);
    expect(editado.costo_manual).toBe(true);
    expect((await armados(s.perfume.id, s.presentacion.id)).costo).toBeCloseTo(74580, 2);
  });

  it('el promedio de la ficha se pondera, no se pisa', async () => {
    const s = await sembrarFabricacion30ml({ stock: 2000 });
    await registrarProduccion({
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 3,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 3),
    });
    const viejo = (await armados(s.perfume.id, s.presentacion.id)).costo;
    const lote = await armar(s, 1);

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 1), costo_unitario: 100000,
    });

    const final = await armados(s.perfume.id, s.presentacion.id);
    expect(final.stock).toBe(4);
    expect(final.costo).toBeCloseTo((viejo * 3 + 100000) / 4, 1);
  });

  it('guarda una línea de historial por edición, la más nueva primero', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 2);

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 4,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 4),
    });
    const dos = await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 6,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 6),
    });

    const historial = dos.historial as unknown as { fecha: string; texto: string }[];
    expect(historial).toHaveLength(2);
    expect(historial[0].texto).toContain('4 → 6 unidades');
    expect(historial[1].texto).toContain('2 → 4 unidades');
  });

  it('bajar la cantidad por debajo de lo ya vendido deja el conteo negativo y no revienta', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 5);
    // Se venden 4 de esos 5 frascos: salen del terminado, como en una venta real.
    await prisma.$transaction(async (tx) => {
      await tx.movimientoTerminado.create({
        data: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id, tipo: 'venta',
          cantidad: -4, costo_unitario: 0, fecha: new Date(FECHA), referencia_id: 1,
        },
      });
      await tx.perfumePresentacion.update({
        where: { perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id } },
        data: { stock: 1 },
      });
    });

    await editarProduccion(lote.id, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 2,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 2),
    });

    // El dato físico manda sobre el sistema: la pantalla avisa y el dueño
    // decide. Aquí solo se comprueba que el servidor no revienta y que el
    // número refleja la realidad (se armaron 2, se vendieron 4).
    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(-2);
  });

  it('un lote que ya no existe se rechaza con un mensaje, no con un 500', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await expect(editarProduccion(999999, {
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, consumos: consumosDe(s, 1),
    })).rejects.toThrow(/lote/i);
  });
});
