import { prisma } from '../config/prisma';

/** Config de "Sobre nosotros" (fila única). La crea con defaults si no existe. */
export const getConfig = async () => {
  const existente = await prisma.sobreNosotrosConfig.findFirst();
  if (existente) return existente;
  return prisma.sobreNosotrosConfig.create({ data: {} });
};

export interface SobreNosotrosInput {
  titulo?: string;
  historia?: string;
  imagen?: string | null;
  activo?: boolean;
}

export const saveConfig = async (data: SobreNosotrosInput) => {
  const actual = await getConfig();
  return prisma.sobreNosotrosConfig.update({
    where: { id: actual.id },
    data: {
      titulo: data.titulo?.trim() || actual.titulo,
      historia: data.historia ?? actual.historia,
      imagen: data.imagen !== undefined ? data.imagen : actual.imagen,
      activo: data.activo ?? actual.activo,
    },
  });
};
