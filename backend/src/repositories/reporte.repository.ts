import { prisma } from '../config/prisma';
import { getVentasPorMes } from './venta.repository';

/**
 * Reportes del negocio: ventas, compras y clientes.
 *
 * Todo se calcula al vuelo desde los registros; no se guarda ningún acumulado.
 * Mismo criterio que el motor de cupo y la tarjeta de recompensas: si el dueño
 * corrige una venta vieja, el reporte se corrige solo. Un total guardado se
 * desincroniza el primer día que alguien edite algo.
 */

const num = (v: unknown) => Number(v ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Clave AAAA-MM en UTC: las columnas `@db.Date` se leen como medianoche UTC. */
const claveMes = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/**
 * Esqueleto de los últimos N meses con los campos en cero.
 *
 * Se arma con `Date.UTC` a propósito: con `setHours(0,0,0,0)` el corte queda en
 * medianoche LOCAL (05:00 UTC en Colombia) y todo lo del día 1 se sale del mes.
 */
const mesesVacios = <T extends Record<string, number>>(meses: number, campos: T) => {
  const ahora = new Date();
  const desde = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1));
  const filas = new Map<string, { mes: string } & T>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth() - (meses - 1) + i, 1));
    filas.set(claveMes(d), { mes: claveMes(d), ...campos });
  }
  return { desde, filas, sumar: (k: string, campo: keyof T, v: number) => {
    const f = filas.get(k);
    if (f) (f[campo] as number) += v;
  } };
};

// ─────────────────────────── Ventas ───────────────────────────

export const reporteVentas = async (meses = 12) => {
  const { desde } = mesesVacios(meses, {});

  const [serie, ventas, lineas, porTalla] = await Promise.all([
    getVentasPorMes(meses),
    prisma.venta.findMany({
      where: { dia: { gte: desde } },
      select: { valor_venta: true, pagada: true, credito: { select: { id: true } } },
    }),
    // Unidades por producto: la cantidad vive en la línea, no en la venta
    prisma.ventaPerfume.groupBy({
      by: ['perfume_id'],
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 10,
    }),
    prisma.ventaPerfume.groupBy({ by: ['ml'], _sum: { cantidad: true } }),
  ]);

  const perfumes = await prisma.perfume.findMany({
    where: { id: { in: lineas.map((l) => l.perfume_id) } },
    select: { id: true, nombre: true },
  });
  const nombre = new Map(perfumes.map((p) => [p.id, p.nombre]));

  const pagadas = ventas.filter((v) => v.pagada);
  const totalPagado = pagadas.reduce((s, v) => s + num(v.valor_venta), 0);
  const pendientes = ventas.filter((v) => !v.pagada);

  return {
    serie,
    // El ticket promedio se mide solo sobre lo cobrado: incluir lo pendiente
    // infla la cifra con plata que todavía no entró.
    ticket_promedio: pagadas.length ? r2(totalPagado / pagadas.length) : 0,
    num_ventas: ventas.length,
    num_pagadas: pagadas.length,
    num_pendientes: pendientes.length,
    valor_pendiente: r2(pendientes.reduce((s, v) => s + num(v.valor_venta), 0)),
    a_credito: ventas.filter((v) => v.credito).length,
    top_productos: lineas.map((l) => ({
      perfume_id: l.perfume_id,
      nombre: nombre.get(l.perfume_id) ?? `#${l.perfume_id}`,
      unidades: l._sum.cantidad ?? 0,
    })),
    // `ml` en null = venta histórica sin talla o producto que no la tiene
    por_talla: porTalla
      .map((t) => ({ ml: t.ml, unidades: t._sum.cantidad ?? 0 }))
      .sort((a, b) => (a.ml ?? 0) - (b.ml ?? 0)),
  };
};

// ─────────────────────────── Compras ───────────────────────────

export const reporteCompras = async (meses = 12) => {
  const { desde, filas, sumar } = mesesVacios(meses, { compras: 0, envios: 0 });

  const [pagos, movimientos] = await Promise.all([
    prisma.pagoProveedor.findMany({
      where: { dia: { gte: desde } },
      select: {
        dia: true, valor_compra: true, coste_envio: true,
        empresa: { select: { id: true, nombre: true } },
      },
    }),
    // Solo entradas de compra: las producciones y mermas no son gasto nuevo
    prisma.movimientoInventario.findMany({
      where: { tipo: 'compra', fecha: { gte: desde } },
      select: { cantidad: true, costo_unitario: true, insumo: { select: { id: true, nombre: true, unidad: true } } },
    }),
  ]);

  pagos.forEach((p) => {
    sumar(claveMes(p.dia), 'compras', num(p.valor_compra));
    sumar(claveMes(p.dia), 'envios', num(p.coste_envio));
  });

  const porProveedor = new Map<number, { nombre: string; total: number; compras: number }>();
  pagos.forEach((p) => {
    const fila = porProveedor.get(p.empresa.id) ?? { nombre: p.empresa.nombre, total: 0, compras: 0 };
    fila.total += num(p.valor_compra) + num(p.coste_envio);
    fila.compras += 1;
    porProveedor.set(p.empresa.id, fila);
  });

  const porInsumo = new Map<number, { nombre: string; unidad: string; cantidad: number; total: number }>();
  movimientos.forEach((m) => {
    const fila = porInsumo.get(m.insumo.id)
      ?? { nombre: m.insumo.nombre, unidad: m.insumo.unidad, cantidad: 0, total: 0 };
    fila.cantidad += num(m.cantidad);
    fila.total += num(m.cantidad) * num(m.costo_unitario);
    porInsumo.set(m.insumo.id, fila);
  });

  const serie = [...filas.values()].map((f) => ({
    mes: f.mes, compras: r2(f.compras), envios: r2(f.envios), total: r2(f.compras + f.envios),
  }));

  return {
    serie,
    total_gastado: r2(serie.reduce((s, f) => s + f.total, 0)),
    total_envios: r2(serie.reduce((s, f) => s + f.envios, 0)),
    num_compras: pagos.length,
    por_proveedor: [...porProveedor.values()]
      .map((p) => ({ ...p, total: r2(p.total) }))
      .sort((a, b) => b.total - a.total),
    por_insumo: [...porInsumo.values()]
      .map((i) => ({ ...i, cantidad: Math.round(i.cantidad * 1000) / 1000, total: r2(i.total) }))
      .sort((a, b) => b.total - a.total),
  };
};

// ─────────────────────────── Clientes ───────────────────────────

const ROL_CLIENTE = 2;

export const reporteClientes = async (meses = 12) => {
  const { desde, filas, sumar } = mesesVacios(meses, { nuevos: 0 });

  const [users, ventas, creditos] = await Promise.all([
    prisma.user.findMany({
      where: { rol_id: ROL_CLIENTE },
      select: {
        id: true, nombre: true, apellido: true, created_at: true,
        sin_cuenta: true, referido_por: true,
      },
    }),
    // Solo lo cobrado: el ranking de clientes se hace con plata que entró
    prisma.venta.groupBy({
      by: ['user_id'],
      where: { pagada: true, user_id: { not: null } },
      _sum: { valor_venta: true },
      _count: { _all: true },
    }),
    // El crédito no guarda "pagado": el saldo sale siempre de restarle los abonos
    prisma.credito.findMany({
      select: { user_id: true, deuda_inicial: true, abonos: { select: { monto: true } } },
    }),
  ]);

  users.forEach((u) => {
    if (u.created_at >= desde) sumar(claveMes(u.created_at), 'nuevos', 1);
  });

  const persona = new Map(users.map((u) => [u.id, `${u.nombre} ${u.apellido}`.trim()]));
  const top = ventas
    .map((v) => ({
      user_id: v.user_id as number,
      nombre: persona.get(v.user_id as number) ?? `#${v.user_id}`,
      total: r2(num(v._sum.valor_venta)),
      compras: v._count._all,
    }))
    // Una venta puede estar enlazada a un admin o a una ficha borrada: sin
    // nombre el ranking no dice nada, así que esas no entran.
    .filter((v) => persona.has(v.user_id))
    .sort((a, b) => b.total - a.total);

  const saldoDe = (c: { deuda_inicial: unknown; abonos: { monto: unknown }[] }) =>
    num(c.deuda_inicial) - c.abonos.reduce((s, a) => s + num(a.monto), 0);
  const conSaldo = creditos.filter((c) => saldoDe(c) > 0);

  const compraron = new Set(top.map((t) => t.user_id));
  const referidos = users.filter((u) => u.referido_por != null);

  return {
    serie: [...filas.values()],
    total: users.length,
    con_cuenta: users.filter((u) => !u.sin_cuenta).length,
    // Ficha creada por el admin: existe en el sistema pero no entra a la web
    sin_cuenta: users.filter((u) => u.sin_cuenta).length,
    compradores: compraron.size,
    // Cuántos de los registrados nunca han comprado (a quién vale la pena escribirle)
    sin_comprar: users.filter((u) => !compraron.has(u.id)).length,
    con_deuda: conSaldo.length,
    deuda_total: r2(conSaldo.reduce((s, c) => s + saldoDe(c), 0)),
    referidos_total: referidos.length,
    referidos_compraron: referidos.filter((u) => compraron.has(u.id)).length,
    top_clientes: top.slice(0, 10),
  };
};
