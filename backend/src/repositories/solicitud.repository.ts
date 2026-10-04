import type { Prisma, SolicitudTipo } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest, notFound } from '../utils/httpError';
import * as ventaService from '../services/venta.service';
import * as creditoService from '../services/credito.service';
import type { CreateVentaInput } from '../schemas/venta.schema';
import type { CreateCreditoInput } from '../schemas/credito.schema';
import { ADMIN } from '../permisos/permisos';

/**
 * SOLICITUDES AL DUEÑO (2026-10-04, decisiones del dueño):
 *
 * - Borrar una venta o un crédito: el personal sin ese permiso lo PIDE; solo
 *   el dueño aprueba (y entonces se borra, devolviendo la mercancía) o rechaza.
 * - Un descuento (precio menor al normal, regalos o cupón): la venta o el
 *   crédito NO se registra hasta que el dueño decide. Su formulario espera
 *   entero en `datos`, así no cuenta en ningún número ni descuenta inventario.
 *   Si aprueba, se registra con el descuento; si rechaza, a precio normal
 *   (sin regalos ni cupón). Si el cliente desiste, se pide borrarla.
 *
 * La campana del dueño cuenta las pendientes (`notificacion.repository.ts`).
 */

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export interface DatosDescuento<T> { cuerpo: T; precio_normal: number; precio_pedido: number }

export const pedirDescuento = async (
  tipo: 'descuento_venta' | 'descuento_credito', solicitanteId: number, motivo: string,
  datos: DatosDescuento<CreateVentaInput | CreateCreditoInput>, quien: string,
) => prisma.solicitud.create({
  data: {
    tipo, solicitante_id: solicitanteId, motivo: motivo.slice(0, 300),
    datos: datos as unknown as Prisma.InputJsonValue,
    resumen: `${tipo === 'descuento_venta' ? 'Venta' : 'Crédito'} a ${quien}: pide ${pesos(datos.precio_pedido)} (normal ${pesos(datos.precio_normal)})`.slice(0, 300),
  },
});

export const pedirBorrado = async (tipo: 'borrar_venta' | 'borrar_credito', id: number, solicitanteId: number, motivo: string) => {
  if (!motivo.trim()) throw badRequest('Escribe por qué hay que borrarla');
  let resumen: string;
  if (tipo === 'borrar_venta') {
    const v = await prisma.venta.findUnique({ where: { id } });
    if (!v) throw notFound('Esa venta ya no existe');
    resumen = `Borrar la venta #${v.id} de ${v.persona} (${pesos(Number(v.valor_venta))})`;
  } else {
    const c = await prisma.credito.findUnique({ where: { id }, include: { user: true } });
    if (!c) throw notFound('Ese crédito ya no existe');
    resumen = `Borrar el crédito #${c.id} de ${c.user.nombre} ${c.user.apellido} (${pesos(Number(c.deuda_inicial))})`;
  }
  const yaPedida = await prisma.solicitud.findFirst({
    where: { tipo, estado: 'pendiente', ...(tipo === 'borrar_venta' ? { venta_id: id } : { credito_id: id }) },
  });
  if (yaPedida) throw badRequest('Ya se pidió borrarla: está esperando al dueño');
  return prisma.solicitud.create({
    data: {
      tipo, solicitante_id: solicitanteId, motivo: motivo.trim().slice(0, 300), resumen,
      ...(tipo === 'borrar_venta' ? { venta_id: id } : { credito_id: id }),
    },
  });
};

/** El dueño ve todas; el personal, solo las suyas. */
export const listarSolicitudes = async (rolId: number, userId: number, estado?: string) => {
  const filas = await prisma.solicitud.findMany({
    where: {
      ...(rolId === ADMIN ? {} : { solicitante_id: userId }),
      ...(estado === 'pendiente' || estado === 'aprobada' || estado === 'rechazada' ? { estado } : {}),
    },
    orderBy: [{ estado: 'asc' }, { id: 'desc' }],
    take: 200,
  });
  const ids = [...new Set(filas.map((f) => f.solicitante_id))];
  const personas = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, apellido: true } });
  const nombre = new Map(personas.map((p) => [p.id, `${p.nombre} ${p.apellido}`.trim()]));
  return filas.map((f) => ({
    id: f.id, tipo: f.tipo, estado: f.estado, resumen: f.resumen, motivo: f.motivo,
    solicitante: nombre.get(f.solicitante_id) ?? 'Alguien que ya no está',
    respuesta: f.respuesta, created_at: f.created_at, resuelta_en: f.resuelta_en,
  }));
};

const sinDescuento = <T extends { lineas?: { regalo: number }[] }>(cuerpo: T) => ({
  ...cuerpo, codigo_descuento: null, lineas: cuerpo.lineas?.map((l) => ({ ...l, regalo: 0 })),
});

/**
 * Lo que pasa al decidir. Aprobar un descuento registra la venta o el crédito
 * como se pidió; rechazarlo, a precio normal. Aprobar un borrado borra (y
 * devuelve la mercancía al inventario). Si registrar o borrar falla, la
 * solicitud sigue pendiente y el dueño ve por qué.
 */
const ejecutar = async (tipo: SolicitudTipo, s: { venta_id: number | null; credito_id: number | null; datos: unknown }, aprobada: boolean) => {
  if (tipo === 'borrar_venta') { if (aprobada) await ventaService.deleteVenta(String(s.venta_id)); return; }
  if (tipo === 'borrar_credito') { if (aprobada) await creditoService.deleteCredito(String(s.credito_id)); return; }
  if (tipo === 'descuento_venta') {
    const d = s.datos as DatosDescuento<CreateVentaInput>;
    await ventaService.createVenta(aprobada
      ? d.cuerpo
      : { ...sinDescuento(d.cuerpo), valor_venta: d.precio_normal } as CreateVentaInput);
    return;
  }
  const d = s.datos as DatosDescuento<CreateCreditoInput>;
  await creditoService.createCredito(aprobada
    ? d.cuerpo
    : { ...sinDescuento(d.cuerpo), deuda_inicial: d.precio_normal } as CreateCreditoInput);
};

export const resolverSolicitud = async (id: number, aprobada: boolean, duenoId: number, respuesta?: string) => {
  const s = await prisma.solicitud.findUnique({ where: { id } });
  if (!s) throw notFound('Esa solicitud no existe');
  if (s.estado !== 'pendiente') throw badRequest('Esa solicitud ya se resolvió');
  // Se marca primero, con la condición de que siga pendiente: dos clics
  // seguidos (o dos pestañas) no registran la venta dos veces.
  const marcada = await prisma.solicitud.updateMany({
    where: { id, estado: 'pendiente' },
    data: { estado: aprobada ? 'aprobada' : 'rechazada', resuelta_por: duenoId, resuelta_en: new Date(), respuesta: respuesta?.slice(0, 300) || null },
  });
  if (marcada.count === 0) throw badRequest('Esa solicitud ya se resolvió');
  try {
    await ejecutar(s.tipo, s, aprobada);
  } catch (err) {
    await prisma.solicitud.update({ where: { id }, data: { estado: 'pendiente', resuelta_por: null, resuelta_en: null, respuesta: null } });
    throw err;
  }
  return { id, estado: aprobada ? 'aprobada' : 'rechazada' };
};

export const contarPendientes = () => prisma.solicitud.count({ where: { estado: 'pendiente' } });
