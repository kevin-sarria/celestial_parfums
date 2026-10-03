import { prisma } from '../config/prisma';
import { hoyEnColombia } from '../utils/fechas';
import { metaDelMes } from './metaMensual';
import { reporteVentasRango } from './reporteVentasRango';
import { getCreditoTotales } from './credito.repository';
import { calcularNotificaciones } from './notificacion.repository';
import { calcularReposicion } from './reposicion.repository';
import { listaRecompra } from './recompra';

/**
 * La pantalla de INICIO del dashboard: lo que el dueño mira primero cada día.
 *
 * Pedida el 2026-09-28, al revisar el panel entero: hasta entonces el panel
 * abría en la lista de Perfumes, que no sirve para decidir nada.
 *
 * **No calcula nada por su cuenta.** Cada número sale de la MISMA función que
 * la pantalla que lo detalla: las ventas del reporte de ventas, la cartera de
 * Créditos, los pendientes de la campana y las esencias del pedido sugerido.
 * Si Inicio dijera "$1,6 M" y el reporte "$1,5 M", no se podría confiar en
 * ninguno de los dos.
 */

/**
 * El mes en curso hasta hoy, y el mes anterior HASTA EL MISMO DÍA: comparar
 * el 28 de septiembre con agosto entero haría parecer que siempre se va peor.
 * Si el mes anterior es más corto (hoy es 31 y el anterior tuvo 30), se corta
 * en su último día.
 */
export const periodosComparables = (hoy: Date) => {
  const anio = hoy.getUTCFullYear();
  const mes = hoy.getUTCMonth();
  const dia = hoy.getUTCDate();
  const desde = new Date(Date.UTC(anio, mes, 1));
  const desdeAnterior = new Date(Date.UTC(anio, mes - 1, 1));
  const ultimoAnterior = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hastaAnterior = new Date(Date.UTC(anio, mes - 1, Math.min(dia, ultimoAnterior)));
  return { desde, hasta: hoy, desdeAnterior, hastaAnterior };
};

/** Días que se miran para saber qué 1.1 se venden. */
const DIAS_VENTAS_11 = 90;

/**
 * Los 1.1 que están en la tienda y cuántos frascos armados tienen, con lo que
 * se vendió de cada uno en los últimos 90 días. Un 1.1 SOLO se vende armado
 * (`solo_armado`), así que uno que se vende y está en cero es plata perdida.
 */
const frascos11 = async (hoy: Date) => {
  const desde = new Date(hoy.getTime() - DIAS_VENTAS_11 * 86_400_000);
  const [perfumes, vendidos] = await Promise.all([
    prisma.perfume.findMany({
      where: { solo_armado: true, publicado: true, es_accesorio: false },
      select: { id: true, nombre: true, presentaciones: { select: { stock: true } } },
    }),
    prisma.ventaPerfume.groupBy({
      by: ['perfume_id'],
      where: { venta: { dia: { gte: desde } }, perfume: { solo_armado: true } },
      _sum: { cantidad: true },
    }),
  ]);
  const vendidosDe = new Map(vendidos.map((v) => [v.perfume_id, v._sum.cantidad ?? 0]));

  const filas = perfumes.map((p) => ({
    perfume_id: p.id,
    nombre: p.nombre,
    armados: p.presentaciones.reduce((s, x) => s + Number(x.stock), 0),
    vendidos: vendidosDe.get(p.id) ?? 0,
  }));
  return {
    total_armados: filas.reduce((s, f) => s + Math.max(0, f.armados), 0),
    referencias: filas.length,
    // Los que no tienen ninguno, primero los que más se venden
    sin_armar: filas
      .filter((f) => f.armados <= 0)
      .sort((a, b) => b.vendidos - a.vendidos || a.nombre.localeCompare(b.nombre)),
    dias: DIAS_VENTAS_11,
  };
};

/** Cuántas esencias se enseñan en Inicio; el resto está en el pedido sugerido. */
const TOPE_ESENCIAS = 5;

/**
 * Las esencias que primero se acaban, según el consumo real de los últimos
 * 90 días (el mismo cálculo del pedido sugerido). Las que no tienen consumo
 * van al final: están bajo el mínimo, pero no se están gastando.
 */
const esenciasPorAcabarse = async () => {
  const { esencias } = await calcularReposicion();
  const dias = (e: (typeof esencias)[number]) =>
    e.consumo_diario > 0 ? Math.max(0, e.stock) / e.consumo_diario : Number.POSITIVE_INFINITY;
  return {
    total: esencias.length,
    filas: [...esencias]
      .sort((a, b) => dias(a) - dias(b))
      .slice(0, TOPE_ESENCIAS)
      .map((e) => ({
        id: e.id,
        nombre: e.nombre,
        stock: e.stock,
        unidad: e.unidad,
        dias_restantes: Number.isFinite(dias(e)) ? Math.floor(dias(e)) : null,
      })),
  };
};

const ultimasVentas = () =>
  prisma.venta.findMany({
    orderBy: [{ dia: 'desc' }, { id: 'desc' }],
    take: 6,
    select: { id: true, dia: true, persona: true, valor_venta: true, pagada: true, referencia_perfume: true },
  }).then((vs) => vs.map((v) => ({ ...v, valor_venta: Number(v.valor_venta) })));

export const resumenInicio = async () => {
  const hoy = hoyEnColombia();
  const p = periodosComparables(hoy);

  const [mes, anterior, cartera, pendientes, frascos, esencias, ventas, recompra, meta] = await Promise.all([
    reporteVentasRango(p.desde, p.hasta),
    reporteVentasRango(p.desdeAnterior, p.hastaAnterior),
    getCreditoTotales(),
    calcularNotificaciones(),
    frascos11(hoy),
    esenciasPorAcabarse(),
    ultimasVentas(),
    listaRecompra(),
    metaDelMes(hoy),
  ]);

  return {
    hoy,
    mes: { desde: p.desde, hasta: p.hasta, ventas: mes.ventas, invertido: mes.invertido.total },
    anterior: { desde: p.desdeAnterior, hasta: p.hastaAnterior, ventas: anterior.ventas },
    cartera,
    /** La meta que se puso el dueño para este mes (ver `metaMensual.ts`). */
    meta,
    pendientes,
    frascos_11: frascos,
    esencias,
    ultimas_ventas: ventas,
    // Los primeros a quienes les toca volver a comprar; la lista entera vive en su pestaña
    recompra: {
      resumen: recompra.resumen,
      punto_medio_dias: recompra.punto_medio_dias,
      le_toca: recompra.clientes.filter((c) => c.estado === 'le_toca').slice(0, 5),
    },
  };
};
