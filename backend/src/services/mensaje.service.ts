import { prisma } from '../config/prisma';
import type { PlantillaMensajeInput } from '../schemas/mensaje.schema';

/**
 * EL MAESTRO DE MENSAJES: los textos de WhatsApp que el dueño escribe.
 *
 * Viven en la base y no en el código porque el tono lo pone él —escribe distinto
 * a un cliente joven que a uno mayor, y antes cambiar una coma era un despliegue—.
 *
 * Nace VACÍO a propósito: el sistema no inventa su voz. Mientras un caso no tenga
 * ninguna plantilla, el botón que la usaría sale apagado y lo explica.
 */

/** Las de un caso, en el orden en que él las quiere ver. */
export const listar = async (caso: string) =>
  prisma.plantillaMensaje.findMany({
    where: { caso },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });

/** Todas de una: la pantalla las agrupa por caso. */
export const listarTodas = async () =>
  prisma.plantillaMensaje.findMany({
    orderBy: [{ caso: 'asc' }, { orden: 'asc' }, { id: 'asc' }],
  });

export const crear = async (dto: PlantillaMensajeInput) => {
  const { orden, ...resto } = dto;
  // Al final, para que la nueva no se cuele entre las que él ya ordenó.
  const ultima = await prisma.plantillaMensaje.findFirst({
    where: { caso: dto.caso },
    orderBy: { orden: 'desc' },
    select: { orden: true },
  });
  return prisma.plantillaMensaje.create({
    data: { ...resto, orden: orden ?? (ultima?.orden ?? -1) + 1 },
  });
};

export const actualizar = async (id: number, dto: PlantillaMensajeInput) =>
  prisma.plantillaMensaje.update({ where: { id }, data: dto });

export const borrar = async (id: number) => {
  await prisma.plantillaMensaje.delete({ where: { id } });
};
