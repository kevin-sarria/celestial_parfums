import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { cargaInicialArmados, listarTerminado } from './inventario.terminado';

/**
 * FRASCOS QUE YA EXISTÍAN ANTES DEL SISTEMA.
 *
 * Hasta el 2026-08-25 el ÚNICO camino para que un frasco armado existiera era
 * producirlo, y producir descuenta esencia. El dueño tiene 5 frascos 1.1 armados
 * hace semanas: esa esencia ya se gastó y —dato suyo— **no la contó** al hacer el
 * inventario, porque contó solo el líquido suelto. Descontarla otra vez le
 * dejaría las esencias en negativo por un gasto ya restado, así que no podía
 * registrarlos de ninguna forma: la barrera que lo tenía con 5 frascos fuera del
 * sistema.
 *
 * Esto es una CARGA INICIAL: entra el frasco con su costo y no se toca ni un ml
 * de material. Queda anotada como `ajuste`, nunca como `produccion` — un lote que
 * no ocurrió no puede aparecer en Producciones.
 */

const FECHA = new Date('2026-08-25');

describe('carga inicial de frascos ya armados', () => {
  beforeEach(limpiarBase);

  it('suma los frascos sin descontar esencia ni envases', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });

    await cargaInicialArmados({
      perfume_id: s.perfume.id,
      presentacion_id: s.presentacion.id,
      cantidad: 3,
      costo_unitario: 74580,
      fecha: FECHA,
    });

    const fila = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(fila.stock)).toBe(3);
    expect(Number(fila.costo_promedio)).toBe(74580);

    // Lo que de verdad importa: el material no se mueve.
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
    expect((await estadoDe(s.diluyente.id)).stock).toBe(1000);
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000);
  });

  it('queda anotada como ajuste, no como producción', async () => {
    const s = await sembrarFabricacion30ml();

    await cargaInicialArmados({
      perfume_id: s.perfume.id,
      presentacion_id: s.presentacion.id,
      cantidad: 2,
      costo_unitario: 50000,
      fecha: FECHA,
    });

    const movs = await prisma.movimientoTerminado.findMany();
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe('ajuste');
    expect(movs[0].nota).toContain('Carga inicial');
    // Y no aparece ningún lote: ese lote nunca ocurrió.
    expect(await prisma.produccion.count()).toBe(0);
  });

  it('si ya había frascos, promedia el costo como cualquier entrada', async () => {
    const s = await sembrarFabricacion30ml();
    const clave = { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id, fecha: FECHA };

    await cargaInicialArmados({ ...clave, cantidad: 1, costo_unitario: 40000 });
    await cargaInicialArmados({ ...clave, cantidad: 1, costo_unitario: 60000 });

    const fila = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(fila.stock)).toBe(2);
    expect(Number(fila.costo_promedio)).toBe(50000);
  });

  it('aparece en la lista de "Frascos ya armados" con su plata', async () => {
    const s = await sembrarFabricacion30ml();

    await cargaInicialArmados({
      perfume_id: s.perfume.id,
      presentacion_id: s.presentacion.id,
      cantidad: 3,
      costo_unitario: 74580,
      fecha: FECHA,
    });

    const { filas, unidades, valor } = await listarTerminado();
    expect(unidades).toBe(3);
    expect(valor).toBe(223740);
    expect(filas[0]).toMatchObject({ perfume: 'Eternity', cantidad: 3, costo_unitario: 74580 });
  });

  it('rechaza una cantidad que no suma nada', async () => {
    const s = await sembrarFabricacion30ml();
    const base = {
      perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
      costo_unitario: 1000, fecha: FECHA,
    };

    await expect(cargaInicialArmados({ ...base, cantidad: 0 })).rejects.toThrow(/cuántos frascos/i);
    // Para SACAR frascos está el ajuste de inventario, no esta pantalla: aquí un
    // negativo es siempre un dedazo.
    await expect(cargaInicialArmados({ ...base, cantidad: -2 })).rejects.toThrow(/cuántos frascos/i);
  });

  it('rechaza un costo negativo, que envenenaría la ganancia del mes', async () => {
    const s = await sembrarFabricacion30ml();

    await expect(cargaInicialArmados({
      perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
      cantidad: 1, costo_unitario: -5, fecha: FECHA,
    })).rejects.toThrow(/costo/i);
  });
});
