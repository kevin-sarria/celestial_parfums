import { prisma } from '../config/prisma';
import { paginatedResponse } from '../utils/pagination';

/**
 * Tarjeta de recompensas (fidelidad). Los sellos NO se guardan: se recalculan
 * SIEMPRE del historial de ventas pagadas del cliente (como el motor de cupo),
 * así editar o borrar una venta ajusta los sellos solos. Solo se guarda cuántos
 * sellos ya se consumieron en premios entregados (`sellos_consumidos`).
 */

const DEFAULT_CONFIG = {
  activo: true, sellos_objetivo: 5, premio: 'Un perfume de 10ml GRATIS', min_compra: 0,
  color_fondo: '#141119', color_lineas: '#d9b45a', color_texto: '#ffffff',
};

export const getConfig = async () => {
  const row = await prisma.recompensaConfig.findFirst({ orderBy: { id: 'asc' } });
  return {
    activo: row?.activo ?? DEFAULT_CONFIG.activo,
    sellos_objetivo: row?.sellos_objetivo ?? DEFAULT_CONFIG.sellos_objetivo,
    premio: row?.premio ?? DEFAULT_CONFIG.premio,
    min_compra: Number(row?.min_compra ?? DEFAULT_CONFIG.min_compra),
    color_fondo: row?.color_fondo ?? DEFAULT_CONFIG.color_fondo,
    color_lineas: row?.color_lineas ?? DEFAULT_CONFIG.color_lineas,
    color_texto: row?.color_texto ?? DEFAULT_CONFIG.color_texto,
  };
};

export type RecompensaConfigInput = {
  activo: boolean; sellos_objetivo: number; premio: string; min_compra: number;
  color_fondo: string; color_lineas: string; color_texto: string;
};

export const saveConfig = async (data: RecompensaConfigInput) => {
  const existing = await prisma.recompensaConfig.findFirst({ orderBy: { id: 'asc' } });
  if (existing) await prisma.recompensaConfig.update({ where: { id: existing.id }, data });
  else await prisma.recompensaConfig.create({ data });
  return getConfig();
};

/** Config efectiva de un cliente: la global con el override propio encima. */
const configEfectiva = (
  global: Awaited<ReturnType<typeof getConfig>>,
  ov: { objetivo_override: number | null; premio_override: string | null; min_compra_override: any } | null,
) => ({
  activo: global.activo,
  objetivo: ov?.objetivo_override ?? global.sellos_objetivo,
  premio: ov?.premio_override ?? global.premio,
  min_compra: ov?.min_compra_override != null ? Number(ov.min_compra_override) : global.min_compra,
  tiene_override: !!(ov && (ov.objetivo_override != null || ov.premio_override != null || ov.min_compra_override != null)),
});

/** Cuántas compras pagadas del cliente califican (≥ min_compra). */
const contarSellosGanados = (userId: number, minCompra: number) =>
  prisma.venta.count({ where: { user_id: userId, pagada: true, valor_venta: { gte: minCompra } } });

/** Calcula la tarjeta de un cliente desde su historial. */
export const calcularTarjeta = async (userId: number) => {
  const [global, ov] = await Promise.all([
    getConfig(),
    prisma.recompensaUsuario.findUnique({ where: { user_id: userId } }),
  ]);
  const cfg = configEfectiva(global, ov);
  const ganados = await contarSellosGanados(userId, cfg.min_compra);
  const consumidos = ov?.sellos_consumidos ?? 0;
  const disponibles = Math.max(0, ganados - consumidos);
  const objetivo = Math.max(1, cfg.objetivo);
  const premios_listos = Math.floor(disponibles / objetivo);
  // Sellos que se ven en la tarjeta actual: llena si hay premio listo
  const sellos = premios_listos > 0 ? objetivo : disponibles % objetivo;
  const premio_listo = premios_listos > 0;

  return {
    activo: cfg.activo,
    objetivo,
    premio: cfg.premio,
    min_compra: cfg.min_compra,
    tiene_override: cfg.tiene_override,
    sellos,
    faltan: premio_listo ? 0 : objetivo - sellos,
    premio_listo,
    premios_listos,
    premios_entregados: ov?.premios_entregados ?? 0,
    sellos_historicos: ganados,
    // Colores (globales) para pintar la tarjeta
    colores: { fondo: global.color_fondo, lineas: global.color_lineas, texto: global.color_texto },
  };
};

/**
 * Entrega un premio: consume una tarjeta llena y crea el registro de entrega
 * (para adjuntarle fotos de la galería de ganadores). Recalcula, no confía en
 * el cliente. Devuelve la tarjeta y el id de la entrega creada.
 */
export const entregarPremio = async (userId: number) => {
  const tarjeta = await calcularTarjeta(userId);
  if (!tarjeta.premio_listo) throw new Error('Este cliente todavía no tiene un premio listo');
  const [, entrega] = await prisma.$transaction([
    prisma.recompensaUsuario.upsert({
      where: { user_id: userId },
      create: { user_id: userId, sellos_consumidos: tarjeta.objetivo, premios_entregados: 1 },
      update: { sellos_consumidos: { increment: tarjeta.objetivo }, premios_entregados: { increment: 1 } },
    }),
    prisma.recompensaEntrega.create({
      data: { user_id: userId, premio: tarjeta.premio, imagenes: [], estado: 'pendiente' },
    }),
  ]);
  return { tarjeta: await calcularTarjeta(userId), entrega_id: entrega.id };
};

export type OverrideInput = {
  objetivo_override: number | null;
  premio_override: string | null;
  min_compra_override: number | null;
};

/** Fija (o limpia) la regla especial de un cliente. */
export const setOverride = async (userId: number, data: OverrideInput) => {
  await prisma.recompensaUsuario.upsert({
    where: { user_id: userId },
    create: { user_id: userId, ...data },
    update: data,
  });
  return calcularTarjeta(userId);
};

/** Lista paginada de clientes con su progreso (para el admin). */
export const getClientes = async (page: number, limit: number, search?: string) => {
  const where = {
    rol_id: { not: 1 },
    ...(search
      ? { OR: [
          { nombre: { contains: search } },
          { apellido: { contains: search } },
          { email: { contains: search } },
          { telefono: { contains: search } },
        ] }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: { created_at: 'desc' },
      select: { id: true, nombre: true, apellido: true, email: true, telefono: true, sin_cuenta: true },
    }),
    prisma.user.count({ where }),
  ]);
  const data = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.sin_cuenta ? null : u.email,
      telefono: u.telefono ?? null,
      tarjeta: await calcularTarjeta(u.id),
    })),
  );
  return paginatedResponse(data, total, page, limit);
};
