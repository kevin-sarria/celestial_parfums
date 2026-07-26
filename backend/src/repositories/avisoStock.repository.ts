import { prisma } from '../config/prisma';

/**
 * "Avísame cuando vuelva": captura el interés en un perfume agotado. No hay
 * envío de correos automáticos; el admin ve la demanda con el contacto de cada
 * cliente y le escribe por WhatsApp cuando repone. Guarda `notificado` para
 * saber a quién ya avisó.
 */

/** El cliente pide aviso de un perfume (idempotente). */
export const pedirAviso = async (userId: number, perfumeId: number) => {
  await prisma.avisoStock.upsert({
    where: { user_id_perfume_id: { user_id: userId, perfume_id: perfumeId } },
    create: { user_id: userId, perfume_id: perfumeId },
    update: { notificado: false },
  });
  return { avisando: true };
};

export const cancelarAviso = async (userId: number, perfumeId: number) => {
  await prisma.avisoStock.deleteMany({ where: { user_id: userId, perfume_id: perfumeId } });
  return { avisando: false };
};

/** IDs de perfumes que el cliente está esperando (para pintar el botón). */
export const misAvisos = (userId: number) =>
  prisma.avisoStock
    .findMany({ where: { user_id: userId, notificado: false }, select: { perfume_id: true } })
    .then((rows) => rows.map((r) => r.perfume_id));

// ── Admin ────────────────────────────────────────────────────────────────────

/** Demanda pendiente: por cada perfume esperado, quiénes lo esperan (con contacto). */
export const demandaStock = async () => {
  const rows = await prisma.avisoStock.findMany({
    where: { notificado: false },
    orderBy: { created_at: 'asc' },
    include: {
      perfume: { select: { id: true, nombre: true, imagen_url: true, agotado: true } },
      user: { select: { nombre: true, apellido: true, telefono: true, email: true } },
    },
  });
  // Agrupa por perfume
  const mapa = new Map<number, any>();
  for (const r of rows) {
    if (!mapa.has(r.perfume_id)) {
      mapa.set(r.perfume_id, {
        perfume_id: r.perfume_id,
        nombre: r.perfume.nombre,
        imagen_url: r.perfume.imagen_url,
        agotado: r.perfume.agotado,
        esperando: [] as any[],
      });
    }
    mapa.get(r.perfume_id).esperando.push({
      nombre: `${r.user.nombre} ${r.user.apellido}`,
      telefono: r.user.telefono,
      email: r.user.email,
      fecha: r.created_at,
    });
  }
  return [...mapa.values()].map((g) => ({ ...g, total: g.esperando.length }));
};

/** El admin marca como avisados a todos los que esperaban un perfume. */
export const marcarAvisados = async (perfumeId: number) => {
  await prisma.avisoStock.updateMany({ where: { perfume_id: perfumeId }, data: { notificado: true } });
};
