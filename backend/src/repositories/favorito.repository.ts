import { prisma } from '../config/prisma';
import { selectPerfumesByIds } from './perfume.repository';

/** IDs de los perfumes favoritos del cliente (para pintar los corazones). */
export const idsFavoritos = (userId: number) =>
  prisma.favorito
    .findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { perfume_id: true } })
    .then((rows) => rows.map((r) => r.perfume_id));

/** Perfumes favoritos completos (para la página "Mis favoritos"). */
export const perfumesFavoritos = async (userId: number) =>
  selectPerfumesByIds(await idsFavoritos(userId));

/** Marca/desmarca un perfume como favorito. Devuelve el nuevo estado. */
export const toggleFavorito = async (userId: number, perfumeId: number) => {
  const clave = { user_id_perfume_id: { user_id: userId, perfume_id: perfumeId } };
  const existe = await prisma.favorito.findUnique({ where: clave });
  if (existe) {
    await prisma.favorito.delete({ where: { id: existe.id } });
    return { favorito: false };
  }
  await prisma.favorito.create({ data: { user_id: userId, perfume_id: perfumeId } });
  return { favorito: true };
};
