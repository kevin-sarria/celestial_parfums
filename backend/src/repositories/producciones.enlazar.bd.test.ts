import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { registrarProduccion } from './inventario.producciones';
import { lotesPorEnlazar } from './producciones.enlazar';

/**
 * LOTES POR ENLAZAR.
 *
 * Dos hechos comprobables, nunca el nombre del producto: adivinar por "dice
 * 1.1" fallaría con un "Set 1.1" o con un 1.1 sin esas letras, y una lista que
 * miente en dinero se deja de mirar.
 */

const FECHA = '2026-08-21';

describe('lotes por enlazar', () => {
  beforeEach(limpiarBase);

  it('no marca un lote sano', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await registrarProduccion({
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }, { insumo_id: s.frasco.id, cantidad: 1 }],
    });
    await prisma.perfumePresentacion.update({
      where: {
        perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id },
      },
      data: { envase_insumo_id: s.frasco.id },
    });

    expect(await lotesPorEnlazar()).toHaveLength(0);
  });

  it('marca el lote que descontó material y no dejó ningún frasco', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await registrarProduccion({
      fecha: '2026-08-13', formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }],
    });
    // Como los 5 lotes de agosto: el material salió, los frascos nunca entraron
    // porque el libro del terminado todavía no existía.
    await prisma.movimientoTerminado.deleteMany({ where: { referencia_id: lote.id } });

    const lista = await lotesPorEnlazar();
    expect(lista).toHaveLength(1);
    expect(lista[0].motivo).toBe('sin_frascos');
    expect(lista[0].presentacion_id).toBe(s.presentacion.id);
    // Los consumos viajan: el PATCH del lote los pide de vuelta.
    expect(lista[0].consumos).toEqual([{ insumo_id: s.esencia.id, cantidad: 15 }]);
  });

  it('marca el lote cuyo envase no es el de la ficha, y propone la que sí lo usa', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const envase11 = await crearInsumo('Envase Khamrah 1.1 100ml', {
      tipo: 'envase', precio: 48680, stock: 5,
    });
    const uno = await prisma.perfume.create({
      data: {
        nombre: 'Khamrah 1.1', precio: 150000, solo_armado: true,
        presentaciones: {
          create: { presentacion_id: s.presentacion.id, envase_insumo_id: envase11.id },
        },
      },
    });

    // El lote gastó el envase 1.1 pero sus frascos quedaron en la ficha del
    // perfume corriente: es el caso del lote 6 de Khamrah, tal cual.
    await registrarProduccion({
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: envase11.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }, { insumo_id: envase11.id, cantidad: 1 }],
    });

    const lista = await lotesPorEnlazar();
    expect(lista).toHaveLength(1);
    expect(lista[0].motivo).toBe('envase_ajeno');
    expect(lista[0].ficha_sugerida).toEqual({ id: uno.id, nombre: 'Khamrah 1.1' });
    expect(lista[0].envase_nombre).toBe('Envase Khamrah 1.1 100ml');
  });

  it('un lote sin fragancia no se marca: no hay frascos que atribuirle a nadie', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await registrarProduccion({
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 2,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 30 }],
    });

    expect(await lotesPorEnlazar()).toHaveLength(0);
  });
});
