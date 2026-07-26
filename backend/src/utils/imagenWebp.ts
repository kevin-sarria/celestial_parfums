import sharp from 'sharp';
import path from 'path';
import { uploadsDir } from '../config/upload';

/**
 * Convierte un buffer de imagen a WebP redimensionado y lo guarda en /uploads.
 * Devuelve la URL pública. Pensado para el servidor económico: fotos livianísimas
 * (una foto de celular de 4MB queda en ~80-150KB).
 */
export const guardarWebp = async (buffer: Buffer, baseUrl: string, maxLado = 1400): Promise<string> => {
  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const destino = path.join(uploadsDir, nombre);
  await sharp(buffer)
    .rotate() // respeta la orientación EXIF del celular
    .resize({ width: maxLado, height: maxLado, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(destino);
  return `${baseUrl}/api/uploads/${nombre}`;
};

/** Procesa varias fotos (para reseñas / pruebas de premio). */
export const guardarVariasWebp = (buffers: Buffer[], baseUrl: string) =>
  Promise.all(buffers.map((b) => guardarWebp(b, baseUrl)));
