import dns from 'dns/promises';
import net from 'net';
import { badRequest } from './httpError';

/**
 * Trae una imagen de otro sitio para que el navegador pueda usarla.
 *
 * POR QUÉ EXISTE: muchas fotos del catálogo son enlaces a webs ajenas
 * (fimgs.net y demás). El navegador no puede meterlas en el PDF: para copiar
 * una imagen a un lienzo hace falta permiso CORS del servidor que la aloja, y
 * esos sitios no lo dan — la foto quedaba en blanco. El servidor sí puede
 * descargarla, y al servirla desde nuestro propio dominio el navegador ya la
 * trata como propia.
 *
 * OJO, ESTO ES UNA PUERTA PELIGROSA (SSRF): un endpoint que descarga "la URL
 * que le digas" puede usarse para leer cosas de la red interna del servidor
 * —otros servicios en localhost, o el 169.254.169.254 de los proveedores de
 * nube, que entrega credenciales—. Por eso:
 *   - solo http y https,
 *   - se resuelve el dominio y se RECHAZA si apunta a una IP privada,
 *   - los redirects se siguen a mano y cada salto se vuelve a comprobar
 *     (si no, bastaría un redirect a localhost para saltarse el control),
 *   - solo se acepta contenido que de verdad sea una imagen,
 *   - hay tope de tamaño y de tiempo.
 * Además el endpoint es solo para el admin.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

/** ¿Esta IP es de la red interna? (loopback, privadas, enlace local, nube) */
const esPrivada = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // metadatos de la nube
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true;
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // únicas locales
  if (v6.startsWith('fe80')) return true;                      // enlace local
  // ::ffff:127.0.0.1 y demás IPv4 disfrazadas de IPv6
  const dentro = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
  if (dentro) return esPrivada(dentro[1]);
  return false;
};

/** Comprueba que la URL sea pública y devolvible; lanza si no. */
const validar = async (crudo: string): Promise<URL> => {
  let url: URL;
  try { url = new URL(crudo); } catch { throw badRequest('Esa dirección de imagen no es válida'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw badRequest('Solo se aceptan direcciones http o https');
  }
  // Si ya viene como IP, se comprueba tal cual; si es un dominio, se resuelve.
  const candidatas = net.isIP(url.hostname)
    ? [url.hostname]
    : (await dns.lookup(url.hostname, { all: true })).map((d) => d.address);
  if (!candidatas.length || candidatas.some(esPrivada)) {
    throw badRequest('Esa dirección apunta a la red interna del servidor');
  }
  return url;
};

export interface ImagenRemota {
  cuerpo: Buffer;
  tipo: string;
}

export const traerImagenRemota = async (crudo: string): Promise<ImagenRemota> => {
  let actual = crudo;

  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    const url = await validar(actual);
    const corte = AbortSignal.timeout(TIMEOUT_MS);
    const res = await fetch(url, {
      signal: corte,
      redirect: 'manual', // los seguimos a mano para revalidar cada destino
      headers: {
        // Sin User-Agent muchos CDN responden 403 a lo que parece un bot
        'User-Agent': 'Mozilla/5.0 (compatible; CelestialParfums/1.0)',
        Accept: 'image/*',
      },
    }).catch(() => { throw badRequest('No se pudo descargar esa imagen'); });

    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get('location');
      if (!destino) throw badRequest('No se pudo descargar esa imagen');
      actual = new URL(destino, url).toString();
      continue;
    }
    if (!res.ok) throw badRequest(`El sitio de la imagen respondió ${res.status}`);

    const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!tipo.startsWith('image/')) throw badRequest('Esa dirección no devuelve una imagen');
    // Se mira el tamaño anunciado y, además, el real: el header se puede mentir.
    const anunciado = Number(res.headers.get('content-length') ?? 0);
    if (anunciado > MAX_BYTES) throw badRequest('Esa imagen pesa demasiado');

    const cuerpo = Buffer.from(await res.arrayBuffer());
    if (cuerpo.length > MAX_BYTES) throw badRequest('Esa imagen pesa demasiado');
    return { cuerpo, tipo };
  }

  throw badRequest('La imagen redirige demasiadas veces');
};
