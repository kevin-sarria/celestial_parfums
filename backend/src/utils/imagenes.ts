import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../config/upload';

/**
 * Borra del disco una imagen de /uploads cuando su registro se elimina o la
 * foto se reemplaza: en un servidor pequeño no puede haber archivos huérfanos.
 * Las URLs externas se ignoran y el nombre se restringe al propio directorio
 * de uploads (sin rutas, sin path traversal).
 */
export const borrarImagenSubida = (url?: string | null): void => {
  if (!url) return;
  const m = /\/(?:api\/)?uploads\/([A-Za-z0-9._-]+)$/.exec(url);
  if (!m) return;
  fs.promises.unlink(path.join(uploadsDir, m[1])).catch(() => {
    // Si el archivo ya no existe no hay nada que limpiar
  });
};

/** Al editar un registro: borra la imagen anterior solo si fue reemplazada. */
export const borrarImagenSiCambio = (
  anterior: string | null | undefined,
  nueva: string | null | undefined,
): void => {
  if (anterior && anterior !== (nueva || null)) borrarImagenSubida(anterior);
};
