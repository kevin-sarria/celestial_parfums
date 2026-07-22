import { prisma } from '../config/prisma';
import { CreateCreditoDTO } from '../types/credito.type';
import { paginatedResponse } from '../utils/pagination';
import { agruparEnlaces, buildPerfumeIndex, matchPerfumes } from '../utils/perfumeMatcher';

const includeAll = {
  user: { select: { id: true, nombre: true, apellido: true, telefono: true, email: true, direccion: true, sin_cuenta: true } },
  abonos: { orderBy: { created_at: 'asc' as const } },
  venta: { select: { id: true, pagada: true } },
} as const;

const mapCredito = (c: any) => {
  const abonos = (c.abonos ?? []).map((a: any) => ({
    id: a.id,
    monto: Number(a.monto),
    fecha: a.fecha,
  }));

  const totalAbonado = abonos.reduce((acc: number, a: any) => acc + a.monto, 0);
  const deudaInicial = Number(c.deuda_inicial);

  return {
    id:    c.id,
    fecha: c.fecha,
    // "cliente" para el panel = la persona (usuario o ficha) dueña del crédito
    cliente: {
      id:         c.user.id,
      nombre:     c.user.nombre,
      apellido:   c.user.apellido,
      telefono:   c.user.telefono ?? null,
      correo:     c.user.sin_cuenta ? null : c.user.email,
      direccion:  c.user.direccion ?? null,
      sin_cuenta: c.user.sin_cuenta,
    },
    articulos:      c.articulos,
    deuda_inicial:  deudaInicial,
    abonos,
    total_abonado:  totalAbonado,
    total_en_deuda: Math.max(0, deudaInicial - totalAbonado),
    venta:          c.venta ? { id: c.venta.id, pagada: c.venta.pagada } : null,
    created_at:     c.created_at,
  };
};

export const getAllCreditos = async (page: number, limit: number, search?: string) => {
  const skip = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { articulos: { contains: search } },
          { user: { nombre: { contains: search } } },
          { user: { apellido: { contains: search } } },
          { user: { telefono: { contains: search } } },
          { user: { email: { contains: search } } },
        ],
      }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.credito.findMany({ where, skip, take: limit, orderBy: { fecha: 'desc' }, include: includeAll }),
    prisma.credito.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapCredito), total, page, limit);
};

/**
 * Un crédito genera su venta enlazada (pendiente de pago): los perfumes
 * salieron ese día y deben contar en el módulo de ventas. Los perfumes del
 * catálogo se detectan del texto de artículos (igual que en las importaciones).
 */
export const createCredito = async (data: CreateCreditoDTO) => {
  const [user, catalogo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.user_id },
      select: { nombre: true, apellido: true },
    }),
    prisma.perfume.findMany({ select: { id: true, nombre: true } }),
  ]);
  if (!user) throw new Error('La persona del crédito no existe');

  const perfumeIds = matchPerfumes(data.articulos, buildPerfumeIndex(catalogo));

  const row = await prisma.$transaction(async (tx) => {
    const venta = await tx.venta.create({
      data: {
        dia:                new Date(data.fecha),
        persona:            `${user.nombre} ${user.apellido}`.trim(),
        user_id:            data.user_id,
        cantidad_perfumes:  Math.max(1, perfumeIds.length),
        presentacion:       '—',
        referencia_perfume: data.articulos,
        perfumes:           { create: agruparEnlaces(perfumeIds) },
        valor_venta:        data.deuda_inicial,
        datos_adicionales:  'Venta a crédito (se marca pagada al saldar el crédito)',
        pagada:             false,
      },
    });
    return tx.credito.create({
      data: {
        fecha:         new Date(data.fecha),
        user_id:       data.user_id,
        articulos:     data.articulos,
        deuda_inicial: data.deuda_inicial,
        venta_id:      venta.id,
      },
      include: includeAll,
    });
  });
  return mapCredito(row);
};

/** La venta enlazada refleja el estado real de la deuda: pagada ⇔ saldada. */
const sincronizarVenta = async (creditoId: number) => {
  const credito = await prisma.credito.findUnique({
    where: { id: creditoId },
    include: { abonos: { select: { monto: true } }, venta: { select: { id: true, pagada: true } } },
  });
  if (!credito?.venta) return;
  const abonado = credito.abonos.reduce((s, a) => s + Number(a.monto), 0);
  const saldada = abonado >= Number(credito.deuda_inicial);
  if (credito.venta.pagada !== saldada) {
    await prisma.venta.update({ where: { id: credito.venta.id }, data: { pagada: saldada } });
  }
};

export const addAbono = async (id: string, monto: number) => {
  const credito = await prisma.credito.findUnique({ where: { id: Number(id) } });
  if (!credito) throw new Error('Crédito no encontrado');

  await prisma.creditoAbono.create({
    data: {
      credito_id: Number(id),
      monto,
      fecha: new Date(),
    },
  });
  await sincronizarVenta(Number(id));

  const row = await prisma.credito.findUnique({
    where: { id: Number(id) },
    include: includeAll,
  });
  return mapCredito(row);
};

export const deleteAbono = async (abonoId: string) => {
  const abono = await prisma.creditoAbono.delete({ where: { id: Number(abonoId) } });
  // Si al quitar el abono la deuda se reabre, la venta vuelve a quedar pendiente
  await sincronizarVenta(abono.credito_id);
};

export const deleteCredito = async (id: string) => {
  const credito = await prisma.credito.delete({ where: { id: Number(id) } });
  // La venta nació con el crédito: si el crédito fue un error, la venta también
  if (credito.venta_id) {
    await prisma.venta.delete({ where: { id: credito.venta_id } }).catch(() => {});
  }
  return credito;
};
