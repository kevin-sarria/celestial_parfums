import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import {
  cerrarMaceracion, convertirLoteEnMaceracion, eliminarMaceracion, envasar,
  listarMaceraciones, macerar,
} from './inventario.maceracion';
import { eliminarProduccion, registrarProduccion } from './inventario.producciones';

/**
 * MACERAR Y ENVASAR contra la base.
 *
 * Lo que estas pruebas vigilan no es "que funcione": es que **el líquido no se
 * cuente dos veces**. El sistema viejo descontaba la esencia al producir y otra
 * vez al vender; el nuevo la descuenta al macerar y **no la vuelve a tocar** al
 * envasar. Si alguien rompe eso, aquí se cae.
 *
 * Diseño: `docs/superpowers/specs/2026-08-24-maceracion-y-envasado-design.md`.
 */

const FECHA = '2026-08-11';

/** El escenario del dueño: su receta de 30 ml con todos los materiales cargados. */
const sembrar = async () => {
  const s = await sembrarFabricacion30ml({ stock: 1000 });
  return s;
};

describe('poner a macerar', () => {
  beforeEach(limpiarBase);

  it('descuenta el líquido y NO toca ni un envase', async () => {
    const s = await sembrar();

    const tanda = await macerar({
      fecha: FECHA, perfume_id: s.perfume.id, formula_volumen_id: s.formula.id, ml: 60,
    });

    // La receta de 30 ml escalada a 60: 30 esencia, 0,8 sellador, 0,6 feromonas
    // y el resto de diluyente.
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 30);
    expect((await estadoDe(s.sellador.id)).stock).toBe(1000 - 0.8);
    expect((await estadoDe(s.feromonas.id)).stock).toBe(1000 - 0.6);
    expect((await estadoDe(s.diluyente.id)).stock).toBe(1000 - 28.6);
    // ESTO es lo que el sistema hacía mal: los frascos siguen en la repisa.
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000);

    // 30×1500 + 28,6×20 + 0,8×100 + 0,6×100 = 45.712 por 60 ml
    expect(Number(tanda.costo_total)).toBe(45712);
    expect(Number(tanda.costo_ml)).toBeCloseTo(761.866667, 5);
  });

  it('el material sale con tipo `maceracion`, no `produccion`', async () => {
    // No es cosmético: revertir busca por tipo + referencia, y con los dos bajo
    // el mismo tipo, borrar un lote devolvería material de una maceración ajena.
    const s = await sembrar();
    const tanda = await macerar({
      fecha: FECHA, perfume_id: s.perfume.id, formula_volumen_id: s.formula.id, ml: 60,
    });

    const movs = await prisma.movimientoInventario.findMany({
      where: { referencia_id: tanda.id, tipo: 'maceracion' },
    });
    expect(movs).toHaveLength(4);
  });

  it('una fragancia sin esencia asignada se rechaza con un mensaje, no con un 500', async () => {
    const s = await sembrar();
    const huerfano = await prisma.perfume.create({ data: { nombre: 'Sin esencia', precio: 50000 } });

    await expect(macerar({
      fecha: FECHA, perfume_id: huerfano.id, formula_volumen_id: s.formula.id, ml: 60,
    })).rejects.toThrow(/esencia/i);
  });
});

describe('envasar de una tanda', () => {
  beforeEach(limpiarBase);

  const conTanda = async (ml = 60) => {
    const s = await sembrar();
    const tanda = await macerar({
      fecha: FECHA, perfume_id: s.perfume.id, formula_volumen_id: s.formula.id, ml,
    });
    return { s, tanda };
  };

  it('gasta envases, suma frascos armados y baja el saldo', async () => {
    const { s, tanda } = await conTanda();
    const esenciaTrasMacerar = (await estadoDe(s.esencia.id)).stock;

    const res = await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-25', formula_volumen_id: s.formula.id,
      cantidad: 2, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });

    expect((await estadoDe(s.frasco.id)).stock).toBe(1000 - 2);
    // La esencia NO se vuelve a tocar: ya salió al macerar.
    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaTrasMacerar);
    expect(res.saldo_ml).toBe(0);

    const armados = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(armados.stock)).toBe(2);
  });

  it('macerar y envasar cuesta lo MISMO que armar directo', async () => {
    // La igualdad que sostiene el diseño entero, medida contra la base y no
    // solo con aritmética: si no se cumple, el costo del frasco depende de cómo
    // trabajó el dueño ese día.
    const { s, tanda } = await conTanda();
    const porMaceracion = await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-25', formula_volumen_id: s.formula.id,
      cantidad: 2, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });

    const directo = await registrarProduccion({
      fecha: '2026-08-25', formula_volumen_id: s.formula.id, cantidad: 2,
      perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
      consumos: [
        { insumo_id: s.esencia.id, cantidad: 30 },
        { insumo_id: s.diluyente.id, cantidad: 28.6 },
        { insumo_id: s.sellador.id, cantidad: 0.8 },
        { insumo_id: s.feromonas.id, cantidad: 0.6 },
        { insumo_id: s.frasco.id, cantidad: 2 },
      ],
    });

    expect(Number(porMaceracion.lote.costo_unitario))
      .toBeCloseTo(Number(directo.costo_unitario), 2);
  });

  it('se puede envasar en DOS tallas distintas del mismo granel', async () => {
    const { s, tanda } = await conTanda(100);
    // Una talla de 10 ml, para partir la tanda en dos formatos.
    const chica = await prisma.formulaVolumen.create({
      data: {
        nombre: '10 ml', ml_total: 10, esencia_ml: 5, sellador_ml: 0.1, feromonas_ml: 0.1,
        envase_insumo_id: s.frasco.id,
      },
    });
    await prisma.presentacion.create({
      data: { nombre: '10ml', ml: 10, formula_volumen_id: chica.id },
    });

    await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-25', formula_volumen_id: s.formula.id,
      cantidad: 2, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });
    const segunda = await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-26', formula_volumen_id: chica.id,
      cantidad: 3, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });

    // 100 − (2 × 30) − (3 × 10) = 10
    expect(segunda.saldo_ml).toBe(10);
  });

  it('envasar más de lo que hay avisa y DEJA pasar', async () => {
    const { s, tanda } = await conTanda(30);

    const res = await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-25', formula_volumen_id: s.formula.id,
      cantidad: 3, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });

    expect(res.saldo_ml).toBe(-60);
    expect(res.aviso).toMatch(/negativo/i);
  });

  it('borrar un envasado devuelve los ml al granel, los envases y quita los frascos', async () => {
    const { s, tanda } = await conTanda();
    const res = await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-25', formula_volumen_id: s.formula.id,
      cantidad: 2, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });

    await eliminarProduccion(res.lote.id);

    const [despues] = await listarMaceraciones();
    expect(despues.saldo_ml).toBe(60);
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000);
    const armados = await prisma.perfumePresentacion.findUnique({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(armados?.stock ?? 0)).toBe(0);
  });
});

describe('cerrar y borrar una tanda', () => {
  beforeEach(limpiarBase);

  it('cerrar anota lo que quedaba como merma y deja el saldo en cero', async () => {
    const s = await sembrar();
    const tanda = await macerar({
      fecha: FECHA, perfume_id: s.perfume.id, formula_volumen_id: s.formula.id, ml: 100,
    });
    await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-25', formula_volumen_id: s.formula.id,
      cantidad: 3, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });

    const cerrada = await cerrarMaceracion(tanda.id, '2026-08-28');

    expect(Number(cerrada.ml_merma)).toBe(10);
    const [conCerradas] = await listarMaceraciones({ incluirCerradas: true });
    expect(conCerradas.saldo_ml).toBe(0);
    // Y desaparece de las que están macerando ahora.
    expect(await listarMaceraciones()).toHaveLength(0);
  });

  it('borrar una tanda SIN envasar devuelve su líquido', async () => {
    const s = await sembrar();
    const tanda = await macerar({
      fecha: FECHA, perfume_id: s.perfume.id, formula_volumen_id: s.formula.id, ml: 60,
    });

    await eliminarMaceracion(tanda.id);

    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
    expect((await estadoDe(s.diluyente.id)).stock).toBe(1000);
  });

  it('borrar una tanda CON envasados se rechaza diciendo cuántos hay', async () => {
    // Es el arreglo de fondo del susto viejo: borrarla devolvería una esencia
    // que sí se gastó, porque está dentro de los frascos ya envasados.
    const s = await sembrar();
    const tanda = await macerar({
      fecha: FECHA, perfume_id: s.perfume.id, formula_volumen_id: s.formula.id, ml: 60,
    });
    await envasar({
      maceracion_id: tanda.id, fecha: '2026-08-25', formula_volumen_id: s.formula.id,
      cantidad: 1, perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
    });

    await expect(eliminarMaceracion(tanda.id)).rejects.toThrow(/1 envasado/);
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 30);
  });
});

describe('convertir un lote viejo en maceración', () => {
  beforeEach(limpiarBase);

  /** El caso real del 212 VIP Black: un lote armado que en realidad reposa. */
  const loteViejo = async () => {
    const s = await sembrar();
    const bolsa = await crearInsumo('Bolsa Organza', { tipo: 'accesorio', precio: 300, stock: 100 });
    await prisma.formulaAccesorio.create({
      data: { formula_volumen_id: s.formula.id, insumo_id: bolsa.id },
    });
    const lote = await registrarProduccion({
      fecha: FECHA, formula_volumen_id: s.formula.id, cantidad: 5,
      perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
      consumos: [
        { insumo_id: s.esencia.id, cantidad: 75 },
        { insumo_id: s.diluyente.id, cantidad: 71.5 },
        { insumo_id: s.frasco.id, cantidad: 5 },
        { insumo_id: bolsa.id, cantidad: 5 },
      ],
    });
    return { s, bolsa, lote };
  };

  it('devuelve envases Y accesorios, quita los frascos y deja la tanda con el costo original', async () => {
    const { s, bolsa, lote } = await loteViejo();
    const costoOriginal = Number(lote.costo_total);

    const tanda = await convertirLoteEnMaceracion(lote.id);

    // 1. Los envases y accesorios vuelven: nunca se usaron.
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000);
    expect((await estadoDe(bolsa.id)).stock).toBe(100);
    // 2. El líquido NO vuelve: está dentro del frasco que reposa.
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 75);
    expect((await estadoDe(s.diluyente.id)).stock).toBe(1000 - 71.5);
    // 3. Los frascos que el sistema creía tener desaparecen.
    const armados = await prisma.perfumePresentacion.findUnique({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(armados?.stock ?? 0)).toBe(0);
    // 4. La tanda queda con la fecha y el costo ORIGINALES, no los de hoy.
    expect(Number(tanda.ml_iniciales)).toBe(150);
    expect(tanda.fecha.toISOString().slice(0, 10)).toBe(FECHA);
    /**
     * 4b. Y vale SOLO EL LÍQUIDO. El lote costaba también los 5 envases
     * ($2.850 c/u) y las 5 bolsas ($300 c/u); esa plata volvió a la repisa con
     * ellos. Dejarla dentro del granel la haría pagar dos veces al envasar.
     */
    const devuelto = 5 * 2850 + 5 * 300;
    expect(Number(tanda.costo_total)).toBe(Math.round((costoOriginal - devuelto) * 100) / 100);
    expect(Number(tanda.costo_ml)).toBeCloseTo(Number(tanda.costo_total) / 150, 5);
    // 5. Y el lote deja de existir: nunca fue un envasado.
    expect(await prisma.produccion.findUnique({ where: { id: lote.id } })).toBeNull();
  });

  it('el líquido queda apuntando a la tanda, así que borrarla lo devuelve bien', async () => {
    const { s, lote } = await loteViejo();
    const tanda = await convertirLoteEnMaceracion(lote.id);

    await eliminarMaceracion(tanda.id);

    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
  });

  it('si ya se vendió un frasco de ese lote, no se convierte', async () => {
    const { s, lote } = await loteViejo();
    // Se vende uno: esos frascos existieron de verdad.
    await prisma.perfumePresentacion.update({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
      data: { stock: 4 },
    });

    await expect(convertirLoteEnMaceracion(lote.id)).rejects.toThrow(/vendiste/i);
    // Y no deja nada a medias.
    expect(await prisma.maceracion.count()).toBe(0);
    expect(await prisma.produccion.findUnique({ where: { id: lote.id } })).not.toBeNull();
  });
});
