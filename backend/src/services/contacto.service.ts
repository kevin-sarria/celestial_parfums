import fs from 'fs';
import path from 'path';
import * as contactoRepo from '../repositories/contacto.repository';
import { uploadsDir } from '../config/upload';
import { ContactoConfigInput, ContactoImportInput, ContactoLinkInput } from '../schemas/contacto.schema';

/**
 * Borra del disco un archivo de /uploads referenciado por la URL dada.
 * Ignora URLs externas y errores de disco (el archivo pudo borrarse antes).
 */
const deleteLocalUpload = (url: string | null) => {
  if (!url || !url.includes('/uploads/')) return;
  // basename evita cualquier intento de path traversal en la URL almacenada
  const file = path.join(uploadsDir, path.basename(url));
  fs.unlink(file, () => {});
};

/** Página pública: configuración + solo links activos. */
export const getPublicContacto = async () => {
  const [config, links] = await Promise.all([
    contactoRepo.selectConfig(),
    contactoRepo.selectLinks(true),
  ]);
  return { config, links };
};

/** Panel admin: configuración + todos los links (incluidos inactivos). */
export const getAdminContacto = async () => {
  const [config, links] = await Promise.all([
    contactoRepo.selectConfig(),
    contactoRepo.selectLinks(false),
  ]);
  return { config, links };
};

export const saveConfig = async (data: ContactoConfigInput) => {
  // Si el avatar cambió y el anterior era un archivo subido, se elimina para no dejar basura.
  const previous = await contactoRepo.selectConfig();
  await contactoRepo.upsertConfig(data);
  if (previous.avatar_url && previous.avatar_url !== (data.avatar_url || null)) {
    deleteLocalUpload(previous.avatar_url);
  }
};

/**
 * Sube un nuevo avatar: persiste la URL y borra el archivo anterior del disco.
 * `baseUrl` es la URL pública del backend (derivada del request), para que el
 * enlace guardado sea válido tanto en local como en producción.
 */
export const updateAvatar = async (filename: string, baseUrl: string) => {
  const url = `${baseUrl}/api/uploads/${filename}`;
  const previous = await contactoRepo.selectConfig();
  await contactoRepo.updateAvatarUrl(url);
  if (previous.avatar_url && previous.avatar_url !== url) {
    deleteLocalUpload(previous.avatar_url);
  }
  return url;
};

export const createLink = (data: ContactoLinkInput) => contactoRepo.createLink(data);

export const updateLink = (id: string, data: ContactoLinkInput) =>
  contactoRepo.updateLink(id, data);

export const deleteLink = (id: string) => contactoRepo.deleteLink(id);

export const reorderLinks = (ids: number[]) => contactoRepo.reorderLinks(ids);

/** Respaldo descargable: config + links sin ids ni timestamps (listo para re-importar). */
export const exportContacto = async () => {
  const [config, links] = await Promise.all([
    contactoRepo.selectConfig(),
    contactoRepo.selectLinks(false),
  ]);
  return {
    config,
    links: links.map((l) => ({
      tipo: l.tipo,
      nombre: l.nombre,
      url: l.url,
      emoji: l.emoji,
      icono: l.icono,
      forma: l.forma,
      color_fondo: l.color_fondo,
      color_texto: l.color_texto,
      activo: l.activo,
    })),
  };
};

/** Restaura un respaldo: reemplaza config y links; limpia el avatar subido si cambió. */
export const importContacto = async (data: ContactoImportInput) => {
  const previous = await contactoRepo.selectConfig();
  await contactoRepo.replaceAll(data);
  if (previous.avatar_url && previous.avatar_url !== (data.config.avatar_url || null)) {
    deleteLocalUpload(previous.avatar_url);
  }
  return { links: data.links.length };
};
