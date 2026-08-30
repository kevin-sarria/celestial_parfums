import type { DevolucionEstado, DevolucionMotivo, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { borrarImagenSubida } from '../utils/imagenes';
import type { DevolucionInput } from '../schemas/devolucion.schema';
import { aplicarInventarioDevolucion, revertirInventarioDevolucion } from './devolucion.inventario';

/**
 * Devoluciones y reclamos de garantía, SIEMPRE colgadas de una venta.
 *
 * Por qué así: si la plata devuelta no se ata a la venta que la generó, los
 * "Ingresos del mes" quedan inflados para siempre. Es el mismo criterio que ya
 * usa el proyecto con los créditos para no contar la plata dos veces.
 */

const num = (v: unknown) => Number(v);
/** Fecha de calendario a AAAA-MM-DD (nunca `new Date()`: corre un día en Colombia). */
const fecha = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const INCLUDE = {
  venta: true,
  perfumes: { include: { perfume: { select: { nombre: true } } } },
} as const;

/**
 * La fila tal como la devuelve la consulta de arriba. Se la pedimos a Prisma en
 * vez de escribirla: era el `d: any` que hacía que `d.venta.persoan` compilara
 * feliz y saliera `undefined` en la pantalla.
 */
type FilaDevolucion = Prisma.DevolucionGetPayload<{ include: typeof INCLUDE }>;

const map = (d: FilaDevolucion) => ({
  id: d.id,
  venta_id: d.venta_id,
  user_id: d.user_id,
  origen: d.origen,
  fecha: fecha(d.fecha)!,
  motivo: d.motivo,
  detalle: d.detalle,
  estado: d.estado,
  solucion: d.solucion,
  monto_devuelto: num(d.monto_devuelto),
  fecha_resolucion: fecha(d.fecha_resolucion),
  notas: d.notas,
  reposicion_formula_id: d.reposicion_formula_id,
  reposicion_cantidad: d.reposicion_cantidad,
  producto_devuelto: d.producto_devuelto,
  revendible: d.revendible,
  costo_reposicion: num(d.costo_reposicion),
  costo_envio: num(d.costo_envio),
  /// Lo que TE costó la garantía: plata devuelta + producto repuesto + envío.
  costo_total: num(d.monto_devuelto) + num(d.costo_reposicion) + num(d.costo_envio),
  imagenes: (d.imagenes as string[] | null) ?? [],
  // Contexto de la venta para pintar la tabla sin una segunda llamada
  venta: d.venta ? {
    id: d.venta.id,
    dia: fecha(d.venta.dia)!,
    persona: d.venta.persona,
    valor_venta: num(d.venta.valor_venta),
    referencia_perfume: d.venta.referencia_perfume,
  } : null,
  perfumes: (d.perfumes ?? []).map((p) => ({
    perfume_id: p.perfume_id,
    cantidad: p.cantidad,
    nombre: p.perfume?.nombre ?? '',
  })),
  created_at: d.created_at,
});

/**
 * Comprueba que lo devuelto quepa en la venta. Sin esto se podría devolver más
 * plata de la que entró y los ingresos del mes quedarían en negativo.
 */
const validarContraVenta = async (data: DevolucionInput, ignorarId?: number) => {
  const venta = await prisma.venta.findUnique({
    where: { id: data.venta_id },
    include: { devoluciones: true },
  });
  if (!venta) throw notFound('La venta no existe');

  const yaDevuelto = venta.devoluciones
    .filter((d) => d.id !== ignorarId)
    .reduce((s, d) => s + num(d.monto_devuelto), 0);
  const total = yaDevuelto + data.monto_devuelto;
  if (total > num(venta.valor_venta)) {
    throw badRequest(
      `No puedes devolver más de lo que costó la venta (${num(venta.valor_venta).toLocaleString('es-CO')}).`
      + (yaDevuelto > 0 ? ` Ya se habían devuelto ${yaDevuelto.toLocaleString('es-CO')}.` : ''),
    );
  }
  return venta;
};

/** Campos comunes de crear/editar (las líneas van aparte). */
const datosBase = (data: DevolucionInput) => ({
  venta_id: data.venta_id,
  fecha: new Date(data.fecha),
  motivo: data.motivo,
  detalle: data.detalle ?? null,
  estado: data.estado,
  solucion: data.solucion ?? null,
  monto_devuelto: data.monto_devuelto,
  // Se sella la fecha de resolución sola al cerrar el caso, si no la escribieron
  fecha_resolucion: data.fecha_resolucion
    ? new Date(data.fecha_resolucion)
    : (data.estado === 'resuelta' || data.estado === 'rechazada' ? new Date() : null),
  notas: data.notas ?? null,
  reposicion_formula_id: data.reposicion_formula_id ?? null,
  reposicion_cantidad: data.reposicion_cantidad,
  costo_reposicion: data.costo_reposicion,
  costo_envio: data.costo_envio,
  // Lo que decide qué pasa con el inventario. Se pregunta caso por caso porque
  // el motivo no alcanza para adivinarlo (ver `devolucion.inventario.ts`).
  producto_devuelto: data.producto_devuelto ?? false,
  revendible: data.revendible ?? false,
});

export const listarDevoluciones = async (estado?: DevolucionEstado) => {
  const rows = await prisma.devolucion.findMany({
    where: estado ? { estado } : undefined,
    include: INCLUDE,
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  });
  return rows.map(map);
};

export const obtenerDevolucion = async (id: number) => {
  const row = await prisma.devolucion.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw notFound('Devolución no encontrada');
  return map(row);
};

export const crearDevolucion = async (data: DevolucionInput) => {
  await validarContraVenta(data);
  // Un caso puede nacer ya resuelto —el típico "se lo repuse ayer y lo anoto
  // hoy"—, así que el inventario se aplica también al crear. Sobre uno sin
  // resolver no mueve nada.
  const { row, avisos } = await prisma.$transaction(async (tx) => {
    const creada = await tx.devolucion.create({
      data: {
        ...datosBase(data),
        origen: 'admin',
        perfumes: { create: data.perfumes.map((p) => ({ perfume_id: p.perfume_id, cantidad: p.cantidad })) },
      },
      include: INCLUDE,
    });
    return { row: creada, avisos: await aplicarInventarioDevolucion(tx, creada.id) };
  });
  return { ...map(row), avisos };
};

export const actualizarDevolucion = async (id: number, data: DevolucionInput) => {
  await validarContraVenta(data, id);
  // Las líneas se reemplazan enteras: es más simple y no deja huérfanos
  const { row, avisos } = await prisma.$transaction(async (tx) => {
    await tx.devolucionPerfume.deleteMany({ where: { devolucion_id: id } });
    const actualizada = await tx.devolucion.update({
      where: { id },
      data: {
        ...datosBase(data),
        perfumes: { create: data.perfumes.map((p) => ({ perfume_id: p.perfume_id, cantidad: p.cantidad })) },
      },
      include: INCLUDE,
    });
    // Si ya estaba resuelta, corregirla deshace y rehace su efecto en el
    // inventario: si no, cambiar de 1 a 2 frascos repuestos contaría el primero
    // dos veces. Sobre una devolución sin resolver no mueve nada.
    return { row: actualizada, avisos: await aplicarInventarioDevolucion(tx, id) };
  });
  return { ...map(row), avisos };
};

export const cambiarEstadoDevolucion = async (id: number, estado: DevolucionEstado) => {
  const actual = await prisma.devolucion.findUnique({ where: { id } });
  if (!actual) throw notFound('Devolución no encontrada');
  if (estado === 'resuelta' && !actual.solucion) {
    throw badRequest('Antes de cerrarla, abre el caso y di qué hiciste (reposición o devolución del dinero)');
  }
  /**
   * Cerrar el caso es lo que MUEVE el inventario, y reabrirlo lo deshace.
   *
   * Se hace aquí y no al guardar el formulario porque hasta que no está resuelta
   * no se sabe qué pasó de verdad: un caso en revisión todavía puede terminar
   * rechazado. Todo dentro de la misma transacción que el cambio de estado.
   */
  const { row, avisos } = await prisma.$transaction(async (tx) => {
    const actualizada = await tx.devolucion.update({
      where: { id },
      data: {
        estado,
        fecha_resolucion: estado === 'resuelta' || estado === 'rechazada'
          ? (actual.fecha_resolucion ?? new Date())
          : null,
      },
      include: INCLUDE,
    });
    return { row: actualizada, avisos: await aplicarInventarioDevolucion(tx, id) };
  });
  return { ...map(row), avisos };
};

export const eliminarDevolucion = async (id: number) => {
  const previa = await prisma.devolucion.findUnique({ where: { id } });
  // Las fotos se borran del disco: servidor pequeño, cero huérfanos
  ((previa?.imagenes as string[] | null) ?? []).forEach(borrarImagenSubida);
  return prisma.$transaction(async (tx) => {
    // Borrar el caso deshace lo que movió: el frasco repuesto vuelve y el
    // devuelto se va. Si no, borrar una devolución dejaría el inventario
    // arreglado por un caso que ya no existe.
    await revertirInventarioDevolucion(tx, id);
    return tx.devolucion.delete({ where: { id } });
  });
};

// ── Portal del cliente ──────────────────────────────────────────────────────

/**
 * Compras del cliente con el estado de su reclamo, si ya abrió uno. Solo
 * ventas PAGADAS: sobre un pedido que aún no se pagó no hay nada que devolver.
 */
export const misCompras = async (userId: number) => {
  const ventas = await prisma.venta.findMany({
    where: { user_id: userId, pagada: true },
    include: {
      perfumes: { include: { perfume: { select: { id: true, nombre: true, imagen_url: true } } } },
      devoluciones: { orderBy: { id: 'desc' } },
    },
    orderBy: { dia: 'desc' },
    take: 50,
  });
  return ventas.map((v) => ({
    id: v.id,
    dia: fecha(v.dia)!,
    valor_venta: num(v.valor_venta),
    referencia_perfume: v.referencia_perfume,
    perfumes: v.perfumes.map((p) => ({
      id: p.perfume.id, nombre: p.perfume.nombre,
      imagen_url: p.perfume.imagen_url, cantidad: p.cantidad,
    })),
    // El cliente ve el avance de su caso, no los datos internos
    devoluciones: v.devoluciones.map((d) => ({
      id: d.id,
      fecha: fecha(d.fecha)!,
      motivo: d.motivo,
      detalle: d.detalle,
      estado: d.estado,
      solucion: d.solucion,
      monto_devuelto: num(d.monto_devuelto),
      fecha_resolucion: fecha(d.fecha_resolucion),
      imagenes: (d.imagenes as string[] | null) ?? [],
    })),
  }));
};

/**
 * El cliente abre un reclamo desde el portal. Nace `pendiente` y sin plata:
 * cuánto se devuelve lo decide el admin al resolverlo, nunca el cliente.
 */
export const solicitarDevolucion = async (
  userId: number, ventaId: number, motivo: DevolucionMotivo, detalle: string | null, imagenes: string[],
) => {
  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { devoluciones: true },
  });
  // Mismo mensaje para "no existe" y "no es tuya": no se filtra qué ventas hay
  if (!venta || venta.user_id !== userId) throw notFound('No encontramos esa compra en tu cuenta');
  if (!venta.pagada) throw badRequest('Esa compra todavía figura como pendiente de pago');

  const abierta = venta.devoluciones.some((d) => d.estado === 'pendiente' || d.estado === 'en_revision');
  if (abierta) throw badRequest('Ya tienes un reclamo abierto para esta compra; te responderemos por WhatsApp');

  const row = await prisma.devolucion.create({
    data: {
      venta_id: ventaId,
      user_id: userId,
      origen: 'cliente',
      fecha: new Date(),
      motivo,
      detalle,
      estado: 'pendiente',
      monto_devuelto: 0,
      imagenes,
    },
    include: INCLUDE,
  });
  return map(row);
};

/**
 * Ventas de una persona/texto para el buscador del formulario. Se limita a las
 * últimas para no traer el histórico completo al navegador.
 */
export const buscarVentasParaDevolucion = async (q: string) => {
  const rows = await prisma.venta.findMany({
    where: q ? { OR: [{ persona: { contains: q } }, { referencia_perfume: { contains: q } }] } : undefined,
    include: { perfumes: { include: { perfume: { select: { id: true, nombre: true } } } } },
    orderBy: { dia: 'desc' },
    take: 30,
  });
  return rows.map((v) => ({
    id: v.id,
    dia: fecha(v.dia)!,
    persona: v.persona,
    valor_venta: num(v.valor_venta),
    referencia_perfume: v.referencia_perfume,
    perfumes: v.perfumes.map((p) => ({
      perfume_id: p.perfume_id,
      nombre: p.perfume.nombre,
      cantidad: p.cantidad,
    })),
  }));
};
