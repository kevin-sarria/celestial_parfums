import fs from 'fs/promises';
import path from 'path';
import { uploadsDir } from '../config/upload';
import { guardarWebp } from './imagenWebp';

/**
 * Soportes de una compra: la factura o remisión que manda la distribuidora.
 *
 * Dos caminos distintos a propósito:
 *  - Imagen (foto de la factura) → se comprime a WebP como el resto del sitio;
 *    una foto de celular de 4 MB queda en ~100 KB y el VPS es pequeño.
 *  - PDF → se guarda tal cual (no se puede recomprimir sin dependencias nuevas).
 *
 * El nombre SIEMPRE lo generamos nosotros: usar el del archivo que llega
 * permitiría path traversal y nombres con extensión engañosa.
 */
export const guardarSoporte = async (
  buffer: Buffer, mimetype: string, baseUrl: string,
): Promise<string> => {
  if (mimetype === 'application/pdf') {
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
    await fs.writeFile(path.join(uploadsDir, nombre), buffer);
    return `${baseUrl}/api/uploads/${nombre}`;
  }
  return guardarWebp(buffer, baseUrl);
};

export const guardarSoportes = (
  files: { buffer: Buffer; mimetype: string }[], baseUrl: string,
) => Promise.all(files.map((f) => guardarSoporte(f.buffer, f.mimetype, baseUrl)));
