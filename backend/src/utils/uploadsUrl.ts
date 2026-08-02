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
/** Los soportes de compras además admiten PDF (facturas de las distribuidoras). */
const NOMBRE_OK_SOPORTE = /^[A-Za-z0-9._-]+\.(webp|jpe?g|png|gif|pdf)$/i;

const nombreDeUpload = (url: string, patron: RegExp): string | null => {
  let ruta = url;
  if (/^https?:\/\//i.test(url)) {
    try { ruta = new URL(url).pathname; } catch { return null; }
  }
  const m = ruta.match(/^\/(?:api\/)?uploads\/([^/?#]+)$/);
  return m && patron.test(m[1]) ? m[1] : null;
};

/**
 * Devuelve solo las URLs que apuntan a nuestro /uploads, normalizadas a baseUrl.
 * `conPdf` solo se activa donde de verdad hacen falta (soportes de compra):
 * en reseñas y fotos de premio el PDF no pinta nada y sería superficie de más.
 */
export const sanearUploadsConservados = (
  urls: string[], baseUrl: string, conPdf = false,
): string[] =>
  urls
    .map((u) => nombreDeUpload(u, conPdf ? NOMBRE_OK_SOPORTE : NOMBRE_OK))
    .filter((n): n is string => n !== null)
    .map((n) => `${baseUrl}/api/uploads/${n}`);
