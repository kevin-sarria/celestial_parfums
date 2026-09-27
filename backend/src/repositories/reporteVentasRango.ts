import { prisma } from '../config/prisma';
import {
  mesesDelRango, porMes, resumirCompras, resumirPerdidas, resumirVentas,
  type SalidaFila, type VentaFila,
} from './reporteVentasRango.calculo';

/**
 * Reporte de ventas entre dos fechas: el tablero que el dueño pidió el
 * 2026-09-27 (*"filtrar por un mes en específico… el dinero invertido, las
 * ventas, lo que queda luego de descontar lo vendido… hasta las pérdidas"*).
 * Eligió el rango libre (opción B) sobre el selector de mes.
 *
 * Como todos los reportes: se recalcula del historial en cada llamada, no se
 * guarda nada. La aritmética vive en `reporteVentasRango.calculo.ts`.
 *
 * Todas las cifras son del rango: los rankings también. El reporte anterior
 * contaba "los más vendidos" de TODA la historia sin decirlo.
 */

const num = (v: unknown) => Number(v ?? 0);

/** Los tipos de movimiento que son plata que se fue sin venderse. */
const TIPOS_SALIDA = ['merma', 'ajuste', 'garantia', 'muestra'] as const;

export const reporteVentasRango = async (desde: Date, hasta: Date) => {
  const enRango = { gte: desde, lte: hasta };

  const [ventasRaw, compras, movimientos, devoluciones] = await Promise.all([
    prisma.venta.findMany({
      where: { dia: enRango },
      select: {
        id: true, dia: true, persona: true, valor_venta: true, pagada: true,
        costo_mercancia: true, cantidad_perfumes: true,
        perfumes: { select: { perfume_id: true, ml: true, cantidad: true, regalo: true } },
        credito: { select: { abonos: { select: { monto: true } } } },
      },
    }),
    prisma.pagoProveedor.findMany({
      where: { dia: enRango }, select: { dia: true, valor_compra: true, coste_envio: true },
    }),
    // Solo las SALIDAS (cantidad negativa): un ajuste que suma es la carga
    // inicial o un conteo que encontró de más, no una pérdida.
    prisma.movimientoInventario.findMany({
      where: { fecha: enRango, tipo: { in: [...TIPOS_SALIDA] }, cantidad: { lt: 0 } },
      select: { fecha: true, tipo: true, cantidad: true, costo_unitario: true },
    }),
    prisma.devolucion.findMany({
      where: { estado: 'resuelta', fecha_resolucion: enRango, monto_devuelto: { gt: 0 } },
      select: { fecha_resolucion: true, monto_devuelto: true },
    }),
  ]);

  const ventas: VentaFila[] = ventasRaw.map((v) => ({
    id: v.id,
    dia: v.dia,
    persona: v.persona,
    valor: num(v.valor_venta),
    pagada: v.pagada,
    costo: num(v.costo_mercancia),
    // La cantidad de la VENTA, no la suma de sus líneas: las ventas viejas que
    // no coincidieron con el catálogo no tienen líneas y se perderían.
    unidades: v.cantidad_perfumes,
    regalos: v.perfumes.reduce((s, l) => s + l.regalo, 0),
    abonado: v.credito ? v.credito.abonos.reduce((s, a) => s + num(a.monto), 0) : null,
  }));
  const salidas: SalidaFila[] = movimientos.map((m) => ({
    fecha: m.fecha,
    tipo: m.tipo as SalidaFila['tipo'],
    valor: Math.abs(num(m.cantidad)) * num(m.costo_unitario),
  }));
  const comprasFilas = compras.map((c) => ({ dia: c.dia, valor: num(c.valor_compra), envio: num(c.coste_envio) }));
  const devolFilas = devoluciones.map((d) => ({ fecha: d.fecha_resolucion!, monto: num(d.monto_devuelto) }));

  // ── Mes a mes ──
  const ventasDe = porMes(ventas, (v) => v.dia);
  const comprasDe = porMes(comprasFilas, (c) => c.dia);
  const salidasDe = porMes(salidas, (s) => s.fecha);
  const devolDe = porMes(devolFilas, (d) => d.fecha);
  const meses = mesesDelRango(desde, hasta).map((mes) => {
    const v = resumirVentas(ventasDe(mes));
    return {
      mes,
      unidades: v.unidades,
      vendido: v.vendido,
      en_deuda: v.en_deuda,
      costo: v.costo,
      ganancia: v.ganancia,
      margen_pct: v.margen_pct,
      sin_costo: v.sin_costo.num,
      cobertura_pct: v.cobertura_pct,
      invertido: resumirCompras(comprasDe(mes)).total,
      perdidas: resumirPerdidas(salidasDe(mes), devolDe(mes), ventasDe(mes)).total,
    };
  });

  // ── Rankings del rango, solo de lo pagado (mismo criterio que "vendido") ──
  const lineas = ventasRaw.filter((v) => v.pagada).flatMap((v) => v.perfumes);
  const porPerfume = new Map<number, number>();
  const porTalla = new Map<number | null, number>();
  lineas.forEach((l) => {
    porPerfume.set(l.perfume_id, (porPerfume.get(l.perfume_id) ?? 0) + l.cantidad);
    porTalla.set(l.ml, (porTalla.get(l.ml) ?? 0) + l.cantidad);
  });
  const top = [...porPerfume.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const nombres = new Map((await prisma.perfume.findMany({
    where: { id: { in: top.map(([id]) => id) } }, select: { id: true, nombre: true },
  })).map((p) => [p.id, p.nombre]));

  return {
    desde, hasta,
    ventas: resumirVentas(ventas),
    invertido: resumirCompras(comprasFilas),
    perdidas: resumirPerdidas(salidas, devolFilas, ventas),
    meses,
    top_productos: top.map(([id, unidades]) => ({ perfume_id: id, nombre: nombres.get(id) ?? `#${id}`, unidades })),
    por_talla: [...porTalla.entries()]
      .map(([ml, unidades]) => ({ ml, unidades }))
      .sort((a, b) => (a.ml ?? 0) - (b.ml ?? 0)),
  };
};
