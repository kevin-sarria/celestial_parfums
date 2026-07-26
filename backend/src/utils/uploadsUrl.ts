/**
 * Saneo de URLs de imágenes "a conservar" que llegan del cliente (reseñas y
 * fotos de premio). Solo se aceptan archivos que ya viven en NUESTRO /uploads:
 * se extrae el nombre de archivo (validado) y se reconstruye la URL con nuestra
 * baseUrl, descartando cualquier host ajeno. Así se evita:
 *   - inyectar URLs externas como si fueran fotos propias (phishing/contenido ajeno),
 *   - envenenar el host vía Host header,
 *   - path traversal (el nombre no puede contener "/").
 */
const NOMBRE_OK = /^[A-Za-z0-9._-]+\.(webp|jpe?g|png|gif)$/i;

const nombreDeUpload = (url: string): string | null => {
  let ruta = url;
  if (/^https?:\/\//i.test(url)) {
    try { ruta = new URL(url).pathname; } catch { return null; }
  }
  const m = ruta.match(/^\/(?:api\/)?uploads\/([^/?#]+)$/);
  return m && NOMBRE_OK.test(m[1]) ? m[1] : null;
};

/** Devuelve solo las URLs que apuntan a nuestro /uploads, normalizadas a baseUrl. */
export const sanearUploadsConservados = (urls: string[], baseUrl: string): string[] =>
  urls
    .map(nombreDeUpload)
    .filter((n): n is string => n !== null)
    .map((n) => `${baseUrl}/api/uploads/${n}`);
