import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { notFound } from '../utils/httpError';
import { CreateVentaDTO } from '../types/venta.type';
import { lineasDeVenta } from '../schemas/venta.schema';
import { consumirPorVenta, revertirVenta } from './inventario.consumoVenta';
import { filtroEnum, filtroFecha, filtroNumero, filtroTexto, type MapaFiltros } from '../utils/filtros';

/**
 * Cómo se traduce cada columna filtrable de la tabla de Ventas a una
 * condición de Prisma. `presentacion` y `pagada` son "enum" en la tabla
 * (opciones fijas), aunque `pagada` en la base es un `Boolean`: se traduce
 * a mano en vez de con `filtroEnum` porque la columna no guarda el texto
 * "Pagada"/"Pendiente" que ve el dueño.
 */
export const mapaFiltrosVenta: MapaFiltros = {
  persona: filtroTexto('persona'),
  referencia_perfume: filtroTexto('referencia_perfume'),
  datos_adicionales: filtroTexto('datos_adicionales'),
  cantidad_perfumes: filtroNumero('cantidad_perfumes'),
  valor_venta: filtroNumero('valor_venta'),
  dia: filtroFecha('dia'),
  presentacion: filtroEnum('presentacion'),
  pagada: (f) => (f.type === 'enum' && f.values.length
    ? { pagada: { in: f.values.map((v) => v === 'Pagada') } }
    : null),
};

/** Una línea ya normalizada: producto + talla + unidades. */
type LineaVenta = { perfume_id: number; ml: number | null; cantidad: number };
import { paginatedResponse } from '../utils/pagination';
import { agruparEnlaces, buildPerfumeIndex, matchPerfumes } from '../utils/perfumeMatcher';
import { aplicarCodigoAVenta, liberarCodigoDeVenta, validarCodigoParaVenta, codigoCanjeadoDeVenta } from '../services/anuncio.service';

const includeRel = {
  user: { select: { id: true, nombre: true, apellido: true, telefono: true, email: true } },
  perfumes: { include: { perfume: { select: { id: true, nombre: true } } } },
  codigo: { include: { anuncio: { select: { titulo: true, descuento_pct: true } } } },
} as const;

/** La venta con su cliente, sus perfumes y su cupón: la forma que trae `includeRel`. */
type VentaRow = Prisma.VentaGetPayload<{ include: typeof includeRel }>;

/**
 * Relee la venta recién guardada. `findUnique` puede devolver `null` —si la
 * borraron entre la escritura y esta lectura—, y el mapeador reventaba con un
 * "Cannot read properties of null": el dueño veía un 500 en vez de un aviso.
 */
const releerVenta = async (id: number) => {
  const row = await prisma.venta.findUnique({ where: { id }, include: includeRel });
  if (!row) throw notFound('Esa venta ya no existe');
  return mapVenta(row);
};

const mapVenta = (v: VentaRow) => ({
  id:                 v.id,
  dia:                v.dia,
  persona:            v.persona,
  user_id:            v.user_id ?? null,
  user:               v.user
    ? { id: v.user.id, nombre: v.user.nombre, apellido: v.user.apellido, telefono: v.user.telefono ?? null, email: v.user.email }
    : null,
  cantidad_perfumes:  v.cantidad_perfumes,
  presentacion:       v.presentacion,
  referencia_perfume: v.referencia_perfume,
  // Una venta de combo puede llevar varios perfumes del catálogo enlazados
  perfumes:           (v.perfumes ?? []).map((vp) => ({
    id: vp.perfume.id, nombre: vp.perfume.nombre, ml: vp.ml ?? null,
    cantidad: vp.cantidad ?? 1, regalo: vp.regalo ?? 0,
  })),
  valor_venta:        Number(v.valor_venta),
  datos_adicionales:  v.datos_adicionales ?? null,
  pagada:             v.pagada,
  costo_mercancia:    Number(v.costo_mercancia ?? 0),
  codigo:             v.codigo
    ? {
        codigo: v.codigo.codigo,
        estado: v.codigo.estado,
        titulo: v.codigo.anuncio?.titulo ?? '',
        descuento_pct: v.codigo.anuncio?.descuento_pct ?? 0,
      }
    : null,
  created_at:         v.created_at,
});

/**
 * Listado paginado y, **si se piden, sus totales en la misma respuesta**.
 *
 * La pantalla necesita las dos cosas a la vez y las pedía en dos viajes. Desde
 * Colombia al VPS cada viaje cuesta 100-200 ms, así que pedir por separado lo
 * que se pinta junto es medio segundo regalado. Aquí las dos consultas salen
 * **en paralelo** dentro del mismo `Promise.all`.
 *
 * Bajo petición y no siempre: quien solo quiera la lista (una exportación,
 * otra pantalla) no tiene por qué pagar una agregación de todo el mes.
 */
export const getAllVentas = async (
  page: number, limit: number, search?: string, conTotales = false, filtrosAnd?: object[],
) => {
  const skip = (page - 1) * limit;
  const condiciones: object[] = [];
  if (search) {
    condiciones.push({
      OR: [
        { persona: { contains: search } },
        { referencia_perfume: { contains: search } },
        { presentacion: { contains: search } },
        { datos_adicionales: { contains: search } },
        { user: { nombre: { contains: search } } },
        { user: { apellido: { contains: search } } },
        { user: { telefono: { contains: search } } },
      ],
    });
  }
  if (filtrosAnd?.length) condiciones.push(...filtrosAnd);
  const where = condiciones.length ? { AND: condiciones } : undefined;
  const [rows, total, totales] = await Promise.all([
    prisma.venta.findMany({ where, skip, take: limit, orderBy: { dia: 'desc' }, include: includeRel }),
    prisma.venta.count({ where }),
    conTotales ? getVentaTotales() : undefined,
  ]);
  return { ...paginatedResponse(rows.map(mapVenta), total, page, limit), ...(totales ? { totales } : {}) };
};

/**
 * La referencia visible se construye con los nombres reales del catálogo.
 * Un id repetido significa varias unidades de la misma fragancia ("2× Eros").
 */
/**
 * Texto legible de la venta a partir de sus líneas: "2× Eros 30ml, Sauvage 100ml".
 * Es un RESUMEN derivado, no la fuente de verdad — la verdad son las líneas.
 */
const referenciaFromLineas = async (lineas: LineaVenta[]) => {
  const ids = [...new Set(lineas.map((l) => l.perfume_id))];
  const perfumes = await prisma.perfume.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true },
  });
  if (perfumes.length !== ids.length) {
    throw new Error('Alguno de los productos seleccionados ya no existe en el catálogo');
  }
  const nombreById = new Map(perfumes.map((p) => [p.id, p.nombre]));
  return lineas
    .map((l) => {
      const base = nombreById.get(l.perfume_id) ?? '';
      const talla = l.ml ? ` ${l.ml}ml` : '';
      return l.cantidad > 1 ? `${l.cantidad}× ${base}${talla}` : `${base}${talla}`;
    })
    .join(', ');
};

/** Resumen de tallas para el campo heredado `ventas.presentacion`. */
const presentacionFromLineas = (lineas: LineaVenta[]) => {
  const tallas = [...new Set(lineas.filter((l) => l.ml).map((l) => `${l.ml} ML`))];
  return tallas.join(', ').slice(0, 100);
};

/**
 * ESCRIBIR UNA VENTA Y GASTAR LO QUE SALIÓ: el único sitio donde pasa.
 *
 * Existe porque los créditos armaban su propia venta a mano y en esa copia se
 * quedó fuera el consumo: medido contra producción el 2026-08-24, 4 de 5 ventas
 * a crédito no habían movido un gramo de inventario, y la ganancia del mes salía
 * inflada cada vez que el dueño fiaba. Ahora Ventas y Créditos entran por aquí.
 *
 * Lo que NO hace, a propósito: cupones. Ventas y Créditos tienen políticas
 * distintas y decididas (en Créditos, quitar el código lo libera; en Ventas, un
 * cupón canjeado queda amarrado a su venta), así que cada módulo pone la suya
 * alrededor de esta función.
 *
 * Recibe la transacción: la venta, sus líneas y el descuento del inventario
 * cuadran o no vale ninguno de los tres.
 */
export interface DatosVentaEscritura {
  dia: Date;
  persona: string;
  user_id?: number | null;
  cantidad_perfumes: number;
  /** Si llega vacío se deriva de las tallas de las líneas. */
  presentacion?: string;
  /** Texto legible. Si llega vacío se arma con los nombres del catálogo. */
  referencia?: string;
  valor_venta: number;
  datos_adicionales?: string | null;
  pagada: boolean;
  lineas: LineaVenta[];
}

export const escribirVentaConConsumo = async (
  tx: Prisma.TransactionClient,
  ventaId: number | null,
  d: DatosVentaEscritura,
) => {
  const datos = {
    dia:                d.dia,
    persona:            d.persona,
    user_id:            d.user_id ?? null,
    cantidad_perfumes:  d.cantidad_perfumes,
    presentacion:       d.presentacion || presentacionFromLineas(d.lineas),
    referencia_perfume: d.referencia || (await referenciaFromLineas(d.lineas)),
    valor_venta:        d.valor_venta,
    datos_adicionales:  d.datos_adicionales ?? null,
    pagada:             d.pagada,
  };

  let id = ventaId;
  if (id === null) {
    const creada = await tx.venta.create({ data: { ...datos, perfumes: { create: d.lineas } } });
    id = creada.id;
  } else {
    // Se deshace el consumo anterior: si no, editar contaría doble.
    await revertirVenta(tx, id);
    await tx.venta.update({
      where: { id },
      data: { ...datos, perfumes: { deleteMany: {}, create: d.lineas } },
    });
  }

  const { costo, sinCostear, avisos } = await consumirPorVenta(tx, id, d.dia, d.lineas);
  await tx.venta.update({ where: { id }, data: { costo_mercancia: costo } });
  return { id, avisos: [...avisos, ...sinCostear.map((t) => `No se pudo costear: ${t}.`)] };
};

export const createVenta = async (data: CreateVentaDTO) => {
  const lineas = lineasDeVenta(data);
  const referencia = await referenciaFromLineas(lineas);
  const pagada = data.pagada ?? true;
  const codigo = data.codigo_descuento?.trim() || null;
  // Validar el código ANTES de crear para no dejar una venta a medias
  if (codigo) await validarCodigoParaVenta(codigo, null);
  const { row, avisos } = await prisma.$transaction(async (tx) => {
    const escrita = await escribirVentaConConsumo(tx, null, {
      dia: new Date(data.dia), persona: data.persona, user_id: data.user_id,
      cantidad_perfumes: data.cantidad_perfumes, presentacion: data.presentacion,
      referencia, valor_venta: data.valor_venta,
      datos_adicionales: data.datos_adicionales, pagada, lineas,
    });
    return {
      row: await tx.venta.findUniqueOrThrow({ where: { id: escrita.id }, include: includeRel }),
      avisos: escrita.avisos,
    };
  });
  if (codigo) {
    await aplicarCodigoAVenta(codigo, row.id, pagada);
    return { ...(await releerVenta(row.id)), avisos };
  }
  return { ...mapVenta(row), avisos };
};

export const updateVenta = async (id: string, data: CreateVentaDTO) => {
  const lineas = lineasDeVenta(data);
  const referencia = await referenciaFromLineas(lineas);
  const ventaId = Number(id);
  const pagada = data.pagada ?? true;
  const codigo = data.codigo_descuento?.trim() || null;

  /**
   * Un cupón ya canjeado queda amarrado a su venta: cambiarlo o quitarlo desde
   * el editor lo revivía en silencio y esa persona podía volver a usarlo. Para
   * soltarlo hay que ELIMINAR la venta, que es una acción deliberada.
   * La comprobación vive aquí y no solo en el formulario: la pantalla se puede
   * saltar, el servidor no.
   */
  const yaCanjeado = await codigoCanjeadoDeVenta(ventaId);
  if (yaCanjeado && (codigo?.trim().toUpperCase() ?? '') !== yaCanjeado) {
    throw new Error(
      `Esta venta ya canjeó el cupón ${yaCanjeado}. Para cambiarlo hay que eliminar la venta y volver a registrarla.`,
    );
  }

  if (codigo) await validarCodigoParaVenta(codigo, ventaId);
  const { avisos } = await prisma.$transaction(async (tx) => escribirVentaConConsumo(tx, ventaId, {
    dia: new Date(data.dia), persona: data.persona, user_id: data.user_id,
    cantidad_perfumes: data.cantidad_perfumes, presentacion: data.presentacion,
    referencia, valor_venta: data.valor_venta,
    datos_adicionales: data.datos_adicionales, pagada, lineas,
  }));
  // Si el código cambió o se quitó, el anterior vuelve a quedar activo.
  // Los ya canjeados NO: esos solo se sueltan borrando la venta.
  await liberarCodigoDeVenta(ventaId, codigo, true);
  if (codigo) await aplicarCodigoAVenta(codigo, ventaId, pagada);
  return { ...(await releerVenta(ventaId)), avisos };
};

/**
 * Reintenta el enlace venta→perfumes de las ventas importadas sin ningún
 * enlace (la referencia libre del Excel se compara contra el catálogo).
 */
export const relinkVentasPerfume = async () => {
  const [perfumes, ventas] = await Promise.all([
    prisma.perfume.findMany({ select: { id: true, nombre: true } }),
    prisma.venta.findMany({
      where: { perfumes: { none: {} } },
      select: { id: true, referencia_perfume: true },
    }),
  ]);
  const index = buildPerfumeIndex(perfumes);
  let enlazadas = 0;
  for (const v of ventas) {
    const ids = matchPerfumes(v.referencia_perfume, index);
    if (ids.length) {
      await prisma.ventaPerfume.createMany({
        data: agruparEnlaces(ids).map((e) => ({ venta_id: v.id, ...e })),
        skipDuplicates: true,
      });
      enlazadas++;
    }
  }
  return { revisadas: ventas.length, enlazadas };
};

export const deleteVenta = async (id: string) => {
  // El código enlazado vuelve a estar activo: la venta ya no existe
  await liberarCodigoDeVenta(Number(id));
  return prisma.$transaction(async (tx) => {
    // Lo que salió del inventario con esta venta vuelve a entrar
    await revertirVenta(tx, Number(id));
    return tx.venta.delete({ where: { id: Number(id) } });
  });
};

export const getVentaTotales = async () => {
  // OJO: `ventas.dia`, `pagos.fecha` y `fecha_resolucion` son @db.Date y Prisma
  // los devuelve como medianoche UTC. Si el inicio del mes se arma con
  // setHours(0,0,0,0) queda en medianoche LOCAL (05:00 UTC en Colombia) y todo
  // lo del día 1 cae fuera del mes. Se construye en UTC para que coincidan.
  const ahora = new Date();
  const inicioMes = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1));

  // Ingresos del mes = plata que entró de verdad este mes:
  //  - ventas de contado (sin crédito enlazado) pagadas, por su fecha de venta
  //  - abonos de créditos, por su fecha de abono (así el crédito de un mes
  //    pagado al siguiente cuenta en el mes en que se recibió el dinero)
  //  - MENOS las devoluciones de dinero resueltas este mes: es plata que salió.
  //    Se resta por fecha de resolución (criterio de caja, igual que los abonos):
  //    una venta de marzo devuelta en julio afecta a julio, que es cuando
  //    entregaste el dinero. Sin esto, los ingresos quedan inflados para siempre.
  // La venta enlazada a un crédito NUNCA suma aquí: su plata entra vía abonos.
  const [agg, contadoMes, abonosMes, devueltoMes, devueltoTotal, costoMes] = await Promise.all([
    prisma.venta.aggregate({ _sum: { cantidad_perfumes: true, valor_venta: true } }),
    prisma.venta.aggregate({
      _sum: { valor_venta: true },
      where: { pagada: true, credito: null, dia: { gte: inicioMes } },
    }),
    prisma.creditoAbono.aggregate({
      _sum: { monto: true },
      where: { fecha: { gte: inicioMes } },
    }),
    prisma.devolucion.aggregate({
      _sum: { monto_devuelto: true },
      where: { estado: 'resuelta', fecha_resolucion: { gte: inicioMes } },
    }),
    prisma.devolucion.aggregate({
      _sum: { monto_devuelto: true },
      where: { estado: 'resuelta' },
    }),
    // Lo que costó producir lo vendido este mes: ingresos − esto = ganancia real
    prisma.venta.aggregate({
      _sum: { costo_mercancia: true },
      where: { pagada: true, dia: { gte: inicioMes } },
    }),
  ]);
  const abonos = Number(abonosMes._sum.monto ?? 0);
  const devuelto = Number(devueltoMes._sum.monto_devuelto ?? 0);
  const costo = Number(costoMes._sum.costo_mercancia ?? 0);
  return {
    total_unidades:  agg._sum.cantidad_perfumes ?? 0,
    total_dinero:    Number(agg._sum.valor_venta ?? 0) - Number(devueltoTotal._sum.monto_devuelto ?? 0),
    ingresos_mes:    Number(contadoMes._sum.valor_venta ?? 0) + abonos - devuelto,
    abonos_mes:      abonos,
    devoluciones_mes: devuelto,
    /**
     * Costo de la mercancía vendida este mes y la ganancia que queda.
     * Es lo que convierte "cuánto facturé" en "cuánto gané de verdad". Solo
     * cuenta lo que se pudo costear: un perfume sin esencia asignada suma 0.
     */
    costo_mercancia_mes: costo,
    ganancia_mes: Math.round((Number(contadoMes._sum.valor_venta ?? 0) + abonos - devuelto - costo) * 100) / 100,
  };
};

/**
 * Serie de los últimos 12 meses para el gráfico: lo que entró, lo que costó y
 * lo que quedó. Un solo dato por mes y por concepto — nada de dos escalas.
 */
export const getVentasPorMes = async (meses = 12) => {
  const ahora = new Date();
  const desde = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1));

  const [ventas, abonos, devoluciones] = await Promise.all([
    prisma.venta.findMany({
      where: { pagada: true, credito: null, dia: { gte: desde } },
      select: { dia: true, valor_venta: true, costo_mercancia: true },
    }),
    prisma.creditoAbono.findMany({
      where: { fecha: { gte: desde } },
      select: { fecha: true, monto: true },
    }),
    prisma.devolucion.findMany({
      where: { estado: 'resuelta', fecha_resolucion: { gte: desde } },
      select: { fecha_resolucion: true, monto_devuelto: true },
    }),
  ]);

  /** Clave AAAA-MM en UTC (las columnas @db.Date se leen en UTC). */
  const clave = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const filas = new Map<string, { mes: string; ingresos: number; costo: number }>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth() - (meses - 1) + i, 1));
    filas.set(clave(d), { mes: clave(d), ingresos: 0, costo: 0 });
  }
  const suma = (k: string, campo: 'ingresos' | 'costo', v: number) => {
    const f = filas.get(k);
    if (f) f[campo] += v;
  };
  ventas.forEach((v) => {
    suma(clave(v.dia), 'ingresos', Number(v.valor_venta));
    suma(clave(v.dia), 'costo', Number(v.costo_mercancia));
  });
  abonos.forEach((a) => suma(clave(a.fecha), 'ingresos', Number(a.monto)));
  devoluciones.forEach((d) => {
    if (d.fecha_resolucion) suma(clave(d.fecha_resolucion), 'ingresos', -Number(d.monto_devuelto));
  });

  return [...filas.values()].map((f) => ({
    ...f,
    ingresos: Math.round(f.ingresos * 100) / 100,
    costo: Math.round(f.costo * 100) / 100,
    ganancia: Math.round((f.ingresos - f.costo) * 100) / 100,
  }));
};
