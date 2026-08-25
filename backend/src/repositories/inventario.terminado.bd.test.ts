import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { registrarProduccion, eliminarProduccion } from './inventario.repository';
import { consumirPorVenta, revertirVenta } from './inventario.consumoVenta';
import { listarTerminado } from './inventario.terminado';

/**
 * PRODUCTO TERMINADO: lo que ya está armado no se vuelve a fabricar.
 *
 * Antes del 2026-08-14, producir descontaba los materiales y vender los
 * descontaba OTRA VEZ: el mismo frasco gastaba su esencia dos veces, el costo
 * del mes salía inflado y la esencia se iba a negativo. Nació de un caso real —
 * el dueño armó 9 frascos en producción y no podía venderlos por el sistema.
 *
 * La regla, acordada con él: al vender salen PRIMERO los frascos armados, y su
 * costo es el del día que se armaron, no el que tendría la receta hoy.
 */

const FECHA = new Date('2026-08-14');
const VENTA = 5678;

/** La receta de 30 ml por unidad: 15 esencia, 14,3 diluyente, 0,4 sellador, 0,3 feromonas, 1 frasco. */
const COSTO_RECETA = 15 * 1500 + 14.3 * 20 + 0.4 * 100 + 0.3 * 100 + 2850; // 25.706

const armar = (s: Awaited<ReturnType<typeof sembrarFabricacion30ml>>, cantidad: number) =>
  registrarProduccion({
    fecha: FECHA.toISOString().slice(0, 10),
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

const vender = (perfume_id: number, cantidad: number) =>
  prisma.$transaction((tx) => consumirPorVenta(tx, VENTA, FECHA, [{ perfume_id, ml: 30, cantidad }]));

const armados = async (perfumeId: number, presentacionId: number) => {
  const f = await prisma.perfumePresentacion.findUnique({
    where: { perfume_id_presentacion_id: { perfume_id: perfumeId, presentacion_id: presentacionId } },
  });
  return { stock: Number(f?.stock ?? 0), costo: Number(f?.costo_promedio ?? 0) };
};

describe('producir frascos por adelantado', () => {
  beforeEach(limpiarBase);

  it('armar 10 sube el terminado a 10 y baja la receta × 10 de los materiales', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });

    await armar(s, 10);

    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(10);
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 150);
    expect((await estadoDe(s.diluyente.id)).stock).toBe(1000 - 143);
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000 - 10);
  });

  it('congela lo que costó armar cada frasco', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });

    await armar(s, 10);

    expect((await armados(s.perfume.id, s.presentacion.id)).costo).toBeCloseTo(COSTO_RECETA, 2);
  });
});

describe('vender lo que ya está armado', () => {
  beforeEach(limpiarBase);

  it('NO vuelve a tocar los materiales: eso ya se gastó al armarlo', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 10);
    const esenciaTrasArmar = (await estadoDe(s.esencia.id)).stock;

    const { costo } = await vender(s.perfume.id, 4);

    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(6);
    // Lo que importa: la esencia NO se movió al vender.
    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaTrasArmar);
    expect(costo).toBeCloseTo(COSTO_RECETA * 4, 0);
  });

  it('si no alcanza lo armado, el resto SÍ se fabrica con materiales', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 6);
    const esenciaTrasArmar = (await estadoDe(s.esencia.id)).stock;

    // Se venden 8 teniendo 6 armados: salen 6 de ahí y 2 se arman.
    const { costo } = await vender(s.perfume.id, 8);

    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(0);
    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaTrasArmar - 15 * 2);
    // El costo es la suma de las dos partes, no el de 8 recetas de hoy.
    expect(costo).toBeCloseTo(COSTO_RECETA * 8, 0);
  });

  it('sin nada armado se comporta exactamente como antes', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });

    const { costo } = await vender(s.perfume.id, 3);

    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 45);
    expect(costo).toBe(COSTO_RECETA * 3);
  });
});

describe('verlos en pantalla', () => {
  beforeEach(limpiarBase);

  it('lista qué hay armado, de qué talla y a qué costo', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 7);

    const { filas, unidades, valor } = await listarTerminado();

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ perfume: 'Eternity', talla: '30ml', cantidad: 7 });
    expect(filas[0].costo_unitario).toBeCloseTo(COSTO_RECETA, 2);
    expect(unidades).toBe(7);
    // El valor es lo que costó armarlos, que es la plata que dejó de estar en
    // materiales: sin esta línea, producir hace desaparecer inventario.
    expect(valor).toBeCloseTo(COSTO_RECETA * 7, 0);
  });

  it('lo que se vendió entero deja de aparecer', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 2);
    await vender(s.perfume.id, 2);

    expect((await listarTerminado()).filas).toHaveLength(0);
  });

  it('sin nada armado, la lista viene vacía y en cero', async () => {
    await sembrarFabricacion30ml({ stock: 1000 });

    expect(await listarTerminado()).toMatchObject({ filas: [], unidades: 0, valor: 0 });
  });
});

describe('deshacer', () => {
  beforeEach(limpiarBase);

  it('borrar la venta devuelve los frascos armados', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await armar(s, 10);
    await vender(s.perfume.id, 4);

    await prisma.$transaction((tx) => revertirVenta(tx, VENTA));

    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(10);
  });

  it('borrar el lote devuelve los materiales Y quita los frascos', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await armar(s, 10);

    await eliminarProduccion(lote.id);

    expect((await armados(s.perfume.id, s.presentacion.id)).stock).toBe(0);
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000);
  });
});

/**
 * El costo promedio de una ficha es una PROYECCIÓN del libro, igual que el
 * stock. Hasta el 2026-08-25 solo se tocaba al ENTRAR frascos: revertir un lote
 * restaba las unidades y dejaba el costo del lote borrado mintiendo. Era
 * invisible mientras borrar un lote era raro; deja de serlo desde que el lote se
 * puede editar.
 */
describe('el costo promedio se reconstruye del libro', () => {
  beforeEach(limpiarBase);

  it('borrar el lote caro devuelve el promedio al del lote barato', async () => {
    const s = await sembrarFabricacion30ml({ stock: 2000 });

    await armar(s, 1);
    // Se encarece la esencia entre un lote y otro: el segundo cuesta más.
    await prisma.insumoCosto.update({ where: { id: s.esencia.id }, data: { precio: 4000 } });
    const caro = await armar(s, 1);

    const conLosDos = await armados(s.perfume.id, s.presentacion.id);
    expect(conLosDos.costo).toBeGreaterThan(COSTO_RECETA);

    await eliminarProduccion(caro.id);

    const soloElBarato = await armados(s.perfume.id, s.presentacion.id);
    expect(soloElBarato.stock).toBe(1);
    // Sin recalcular, aquí seguiría el promedio inflado de los dos lotes.
    expect(soloElBarato.costo).toBeCloseTo(COSTO_RECETA, 0);
  });

  it('sin frascos vivos el promedio queda en cero, no en el último costo', async () => {
    const s = await sembrarFabricacion30ml({ stock: 2000 });
    const lote = await armar(s, 3);

    await eliminarProduccion(lote.id);

    const vacio = await armados(s.perfume.id, s.presentacion.id);
    expect(vacio.stock).toBe(0);
    expect(vacio.costo).toBe(0);
  });
});
