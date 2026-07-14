import { prisma } from '../config/prisma';
import { ContactoConfigInput, ContactoImportInput, ContactoLinkInput } from '../schemas/contacto.schema';

interface ConfigRow {
  avatar_url: string | null;
  nombre: string;
  descripcion: string | null;
  fondo_tipo: 'color' | 'imagen';
  fondo_valor: string | null;
  boton_forma: 'redondo' | 'cuadrado';
  boton_color_fondo: string;
  boton_color_texto: string;
  contenido_posicion: 'arriba' | 'centro';
  redes_posicion: 'centro' | 'abajo';
}

/** Valores por defecto cuando aún no se ha guardado configuración. */
const DEFAULT_CONFIG: ConfigRow = {
  avatar_url: null,
  nombre: 'Celestial Parfums',
  descripcion: null,
  fondo_tipo: 'color',
  fondo_valor: null,
  boton_forma: 'redondo',
  boton_color_fondo: '#ffffff',
  boton_color_texto: '#2f2a3d',
  contenido_posicion: 'centro',
  redes_posicion: 'centro',
};

const mapConfig = (c: ConfigRow) => ({
  avatar_url: c.avatar_url ?? null,
  nombre: c.nombre,
  descripcion: c.descripcion ?? null,
  fondo_tipo: c.fondo_tipo,
  fondo_valor: c.fondo_valor ?? null,
  boton_forma: c.boton_forma,
  boton_color_fondo: c.boton_color_fondo,
  boton_color_texto: c.boton_color_texto,
  contenido_posicion: c.contenido_posicion,
  redes_posicion: c.redes_posicion,
});

export const selectConfig = async () => {
  const config = await prisma.contactoConfig.findFirst({ orderBy: { id: 'asc' } });
  return mapConfig(config ?? DEFAULT_CONFIG);
};

export const upsertConfig = async (data: ContactoConfigInput) => {
  const values = {
    avatar_url: data.avatar_url || null,
    nombre: data.nombre,
    descripcion: data.descripcion || null,
    fondo_tipo: data.fondo_tipo,
    fondo_valor: data.fondo_valor || null,
    boton_forma: data.boton_forma,
    boton_color_fondo: data.boton_color_fondo,
    boton_color_texto: data.boton_color_texto,
    contenido_posicion: data.contenido_posicion,
    redes_posicion: data.redes_posicion,
  };
  const existing = await prisma.contactoConfig.findFirst({ orderBy: { id: 'asc' } });
  if (existing) {
    await prisma.contactoConfig.update({ where: { id: existing.id }, data: values });
  } else {
    await prisma.contactoConfig.create({ data: values });
  }
};

const linkOrderBy = [{ orden: 'asc' as const }, { id: 'asc' as const }];

export const selectLinks = (soloActivos: boolean) =>
  prisma.contactoLink.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: linkOrderBy,
  });

/** Actualiza solo el avatar (crea la fila de configuración si aún no existe). */
export const updateAvatarUrl = async (url: string) => {
  const existing = await prisma.contactoConfig.findFirst({ orderBy: { id: 'asc' } });
  if (existing) {
    await prisma.contactoConfig.update({ where: { id: existing.id }, data: { avatar_url: url } });
  } else {
    await prisma.contactoConfig.create({ data: { avatar_url: url } });
  }
};

export const createLink = async (data: ContactoLinkInput) => {
  const max = await prisma.contactoLink.aggregate({ _max: { orden: true } });
  const link = await prisma.contactoLink.create({
    data: {
      tipo: data.tipo,
      nombre: data.nombre,
      url: data.url,
      emoji: data.emoji || null,
      icono: data.icono || null,
      forma: data.forma ?? null,
      color_fondo: data.color_fondo ?? null,
      color_texto: data.color_texto ?? null,
      orden: (max._max.orden ?? 0) + 1,
      activo: data.activo ?? true,
    },
  });
  return link.id;
};

export const updateLink = (id: string, data: ContactoLinkInput) =>
  prisma.contactoLink.update({
    where: { id: Number(id) },
    data: {
      tipo: data.tipo,
      nombre: data.nombre,
      url: data.url,
      emoji: data.emoji || null,
      icono: data.icono || null,
      forma: data.forma ?? null,
      color_fondo: data.color_fondo ?? null,
      color_texto: data.color_texto ?? null,
      activo: data.activo ?? true,
    },
  });

export const deleteLink = (id: string) =>
  prisma.contactoLink.delete({ where: { id: Number(id) } });

export const reorderLinks = (ids: number[]) =>
  prisma.$transaction(
    ids.map((id, index) =>
      prisma.contactoLink.update({ where: { id }, data: { orden: index + 1 } }),
    ),
  );

/** Reemplaza config y links completos desde un respaldo importado (transaccional). */
export const replaceAll = async (data: ContactoImportInput) => {
  const configValues = {
    avatar_url: data.config.avatar_url || null,
    nombre: data.config.nombre,
    descripcion: data.config.descripcion || null,
    fondo_tipo: data.config.fondo_tipo,
    fondo_valor: data.config.fondo_valor || null,
    boton_forma: data.config.boton_forma,
    boton_color_fondo: data.config.boton_color_fondo,
    boton_color_texto: data.config.boton_color_texto,
    contenido_posicion: data.config.contenido_posicion,
    redes_posicion: data.config.redes_posicion,
  };
  const existing = await prisma.contactoConfig.findFirst({ orderBy: { id: 'asc' } });
  await prisma.$transaction([
    existing
      ? prisma.contactoConfig.update({ where: { id: existing.id }, data: configValues })
      : prisma.contactoConfig.create({ data: configValues }),
    prisma.contactoLink.deleteMany({}),
    prisma.contactoLink.createMany({
      data: data.links.map((l, index) => ({
        tipo: l.tipo,
        nombre: l.nombre,
        url: l.url,
        emoji: l.emoji || null,
        icono: l.icono || null,
        forma: l.forma ?? null,
        color_fondo: l.color_fondo ?? null,
        color_texto: l.color_texto ?? null,
        orden: index + 1,
        activo: l.activo ?? true,
      })),
    }),
  ]);
};
