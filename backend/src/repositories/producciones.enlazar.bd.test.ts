import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { registrarProduccion } from './inventario.producciones';
import { crearFicha11YEnlazar, lotesPorEnlazar } from './producciones.enlazar';

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

  it('marca el lote 1.1 que descontó material y no dejó ningún frasco', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    // Con SU envase propio, que es lo que lo delata como 1.1.
    const envase11 = await crearInsumo('Envase Asad 1.1 100ml', {
      tipo: 'envase', precio: 48680, stock: 5,
    });
    const lote = await registrarProduccion({
      fecha: '2026-08-13', formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: envase11.id,
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

  it('un lote armado con el envase del tamaño no se marca aunque no dejara frascos', async () => {
    // Es el caso del 212 VIP Black: esos 500 ml están macerando, no son 5
    // frascos, y su lote usó el envase normal. Decisión del dueño (2026-08-25).
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const lote = await registrarProduccion({
      fecha: '2026-08-11', formula_volumen_id: s.formula.id, cantidad: 5,
      perfume_id: s.perfume.id, envase_insumo_id: s.frasco.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 75 }],
    });
    await prisma.movimientoTerminado.deleteMany({ where: { referencia_id: lote.id } });

    expect(await lotesPorEnlazar()).toHaveLength(0);
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

/**
 * EL BOTÓN QUE CREA LA FICHA QUE FALTA.
 *
 * El aviso pedía elegir una ficha 1.1 que no existía —en producción hay 229
 * perfumes y CERO 1.1—, así que el desplegable salía vacío y el aviso no servía
 * de nada. El botón la crea copiando la del perfume corriente y le manda los
 * frascos de una vez.
 */
describe('crear la ficha 1.1 desde el aviso', () => {
  beforeEach(limpiarBase);

  const corrienteConFicha = async (perfumeId: number) => {
    const aroma = await prisma.tipoAroma.create({ data: { nombre: 'Dulce' } });
    return prisma.perfume.update({
      where: { id: perfumeId },
      data: {
        descripcion: 'Canela y vainilla',
        duracion: '8 horas',
        genero: 'unisex',
        imagen_url: '/uploads/khamrah.webp',
        tipos_aroma: { create: { tipo_aroma_id: aroma.id } },
      },
    });
  };

  it('copia la ficha del corriente (foto incluida), nace apagada y se lleva los frascos', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await corrienteConFicha(s.perfume.id);
    await prisma.categoria.create({ data: { nombre: '1.1' } });
    const envase11 = await crearInsumo('Envase Khamrah 1.1 100ml', {
      tipo: 'envase', precio: 48680, stock: 5,
    });
    const lote = await registrarProduccion({
      fecha: '2026-08-13', formula_volumen_id: s.formula.id, cantidad: 2,
      perfume_id: s.perfume.id, envase_insumo_id: envase11.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 30 }],
    });
    await prisma.movimientoTerminado.deleteMany({ where: { referencia_id: lote.id } });
    const esenciaAntes = (await estadoDe(s.esencia.id)).stock;

    const ficha = await crearFicha11YEnlazar(lote.id, 'Khamrah By Lattafa 1.1');

    const creada = await prisma.perfume.findUniqueOrThrow({
      where: { id: ficha.id }, include: { tipos_aroma: true, presentaciones: true },
    });
    expect(creada.nombre).toBe('Khamrah By Lattafa 1.1');
    expect(creada.descripcion).toBe('Canela y vainilla');
    expect(creada.imagen_url).toBe('/uploads/khamrah.webp');
    expect(creada.tipos_aroma).toHaveLength(1);
    // Es un 1.1: solo se vende armado, con su envase, y NO se ve en la tienda.
    expect(creada.solo_armado).toBe(true);
    expect(creada.publicado).toBe(false);
    expect(creada.categoria_id).not.toBeNull();
    expect(creada.presentaciones[0].envase_insumo_id).toBe(envase11.id);

    // Los frascos entraron a la ficha nueva y la esencia NO se volvió a tocar:
    // ese material se descontó el día del lote.
    const armados = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: { perfume_id: ficha.id, presentacion_id: s.presentacion.id },
      },
    });
    expect(Number(armados.stock)).toBe(2);
    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaAntes);
    // Y el aviso se vacía: ya no queda nada por enlazar.
    expect(await lotesPorEnlazar()).toHaveLength(0);
  });

  it('si los frascos SÍ existían, se mudan a la ficha nueva con su costo', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    await corrienteConFicha(s.perfume.id);
    const envase11 = await crearInsumo('Envase Bon Bon 1.1 100ml', {
      tipo: 'envase', precio: 59498, stock: 5,
    });
    const lote = await registrarProduccion({
      fecha: '2026-08-21', formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: envase11.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }, { insumo_id: envase11.id, cantidad: 1 }],
    });
    const costoOriginal = Number((await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id },
      },
    })).costo_promedio);
    const esenciaAntes = (await estadoDe(s.esencia.id)).stock;

    const ficha = await crearFicha11YEnlazar(lote.id, 'Bon Bon 1.1');

    // Salieron de la ficha del corriente y llegaron a la 1.1, con su costo.
    const viejo = await prisma.perfumePresentacion.findUnique({
      where: {
        perfume_id_presentacion_id: { perfume_id: s.perfume.id, presentacion_id: s.presentacion.id },
      },
    });
    expect(Number(viejo?.stock ?? 0)).toBe(0);
    const nuevo = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: { perfume_id: ficha.id, presentacion_id: s.presentacion.id },
      },
    });
    expect(Number(nuevo.stock)).toBe(1);
    expect(Number(nuevo.costo_promedio)).toBeCloseTo(costoOriginal, 2);
    // Es el mismo lote, solo cambió a dónde apuntan sus frascos: el material
    // ni se devuelve ni se vuelve a gastar.
    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaAntes);
  });

  it('un lote que ya no existe se rechaza con un mensaje, no con un 500', async () => {
    await expect(crearFicha11YEnlazar(999999, 'Fantasma 1.1')).rejects.toThrow(/lote/i);
  });
});

/**
 * EL PRECIO CON EL QUE NACE UN 1.1 (2026-08-29).
 *
 * El susto que lo estrenó: la ficha nueva copiaba el precio del perfume
 * CORRIENTE. Si la lista de los 1.1 no cubría esa talla, un frasco que cuesta el
 * doble se ponía a la venta a precio de contratipo **y nada lo decía**.
 *
 * La regla que se fija aquí es la del dueño: si acepta el precio de la lista, la
 * ficha NO guarda precio propio —así, subir la lista la sube a ella también—; si
 * escribe otro, ese número queda como excepción de esa talla.
 */
describe('el precio del 1.1 recién creado', () => {
  beforeEach(limpiarBase);

  /** Un lote 1.1 listo para enlazar, con su envase propio y sin frascos. */
  const loteListo = async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const envase11 = await crearInsumo('Envase Yum Yum 1.1 100ml', {
      tipo: 'envase', precio: 48680, stock: 5,
    });
    const lote = await registrarProduccion({
      fecha: '2026-08-13', formula_volumen_id: s.formula.id, cantidad: 1,
      perfume_id: s.perfume.id, envase_insumo_id: envase11.id,
      consumos: [{ insumo_id: s.esencia.id, cantidad: 15 }],
    });
    await prisma.movimientoTerminado.deleteMany({ where: { referencia_id: lote.id } });
    return { ...s, lote };
  };

  /** La categoría 1.1 con su lista de precios para la talla del lote. */
  const listaDe11 = async (presentacionId: number, precio: number) => {
    const categoria = await prisma.categoria.create({ data: { nombre: '1.1' } });
    await prisma.precioLista.create({
      data: { categoria_id: categoria.id, presentacion_id: presentacionId, precio },
    });
    return categoria;
  };

  it('el aviso enseña el precio de la lista, no el del corriente', async () => {
    const s = await loteListo();
    await listaDe11(s.presentacion.id, 120000);

    const [aviso] = await lotesPorEnlazar();
    expect(aviso.precio_lista_11).toBe(120000);
    expect(aviso.precio_heredado).toBe(60000);
    expect(aviso.talla_nombre).toBe('30ml');
  });

  it('sin lista para esa talla lo dice, en vez de heredar en silencio', async () => {
    const s = await loteListo();

    const [aviso] = await lotesPorEnlazar();
    // Null es lo que la pantalla pinta en rojo: "esto viene del corriente".
    expect(aviso.precio_lista_11).toBeNull();
    expect(aviso.precio_heredado).toBe(60000);
    expect(aviso.categoria_11).toBeNull();
  });

  it('aceptar el precio de la lista NO guarda precio propio', async () => {
    const s = await loteListo();
    await listaDe11(s.presentacion.id, 120000);

    const ficha = await crearFicha11YEnlazar(s.lote.id, 'Yum Yum 1.1', 120000);

    const talla = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: { perfume_id: ficha.id, presentacion_id: s.presentacion.id },
      },
    });
    // Null = sigue la lista. El día que suba la lista de los 1.1, sube con ella.
    expect(talla.precio).toBeNull();
  });

  it('escribir otro precio lo guarda como excepción de esa talla', async () => {
    const s = await loteListo();
    await listaDe11(s.presentacion.id, 120000);

    const ficha = await crearFicha11YEnlazar(s.lote.id, 'Bon Bon 1.1', 150000);

    const talla = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: { perfume_id: ficha.id, presentacion_id: s.presentacion.id },
      },
    });
    expect(Number(talla.precio)).toBe(150000);
  });

  it('sin lista, el precio va al de respaldo y la ficha queda libre de seguirla luego', async () => {
    const s = await loteListo();

    const ficha = await crearFicha11YEnlazar(s.lote.id, 'Asad 1.1', 130000);

    const creada = await prisma.perfume.findUniqueOrThrow({
      where: { id: ficha.id }, include: { presentaciones: true },
    });
    expect(Number(creada.precio)).toBe(130000);
    // Anclarlo a la talla lo dejaría fuera de la lista para siempre, y esa lista
    // todavía no existe: es justo la que el dueño va a crear.
    expect(creada.presentaciones[0].precio).toBeNull();
  });

  it('sin decir precio manda la lista, no el del corriente', async () => {
    const s = await loteListo();
    await listaDe11(s.presentacion.id, 120000);

    const ficha = await crearFicha11YEnlazar(s.lote.id, 'Mandarin Sky 1.1');

    const creada = await prisma.perfume.findUniqueOrThrow({ where: { id: ficha.id } });
    expect(Number(creada.precio)).toBe(120000);
  });
});
