import { BASE_URL } from '../../infrastructure/api/client';
import type { ClienteSeleccion, CodigoValidado, GuardedFetch } from './types';

export { formatPrice } from '@/lib/format';

export const API          = `${BASE_URL}/api/parfums`;
export const API_COMBOS   = `${BASE_URL}/api/combos`;
export const API_VENTAS   = `${BASE_URL}/api/ventas`;
export const API_CREDITOS = `${BASE_URL}/api/creditos`;
export const API_PAGOS    = `${BASE_URL}/api/pagos`;
export const API_EMPRESAS = `${BASE_URL}/api/empresas`;
export const API_IMPORT   = `${BASE_URL}/api/import`;
export const API_CONTACTO = `${BASE_URL}/api/contacto`;
export const API_USUARIOS = `${BASE_URL}/api/usuarios`;
export const API_ANUNCIOS = `${BASE_URL}/api/anuncios`;
export const API_UPLOAD   = `${BASE_URL}/api/upload`;

export const DEFAULT_PAGE_SIZE = 10;

export const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO');

/** Interpreta el valor crudo del desplegable de persona enlazada. */
export const parseClienteSeleccion = (val: string): ClienteSeleccion =>
  val === '' || val === 'nuevo' ? val : Number(val);

/** Etiqueta legible de una persona en desplegables (oculta emails sintéticos de fichas). */
export const personaLabel = (u: { nombre: string; apellido: string; telefono: string | null; email: string; sin_cuenta: boolean }) => {
  const contacto = u.sin_cuenta ? (u.telefono ?? 'sin cuenta web') : u.email;
  return `${u.nombre} ${u.apellido} · ${contacto}`;
};

/** Sube una imagen del admin y devuelve su URL pública (lanza Error si falla). */
export const subirImagenAdmin = async (
  guardedFetch: GuardedFetch,
  file: File,
  endpoint: string = API_UPLOAD,
): Promise<string> => {
  const fd = new FormData();
  fd.append('image', file);
  const res = await guardedFetch(endpoint, { method: 'POST', body: fd });
  if (res.status === 413) throw new Error('La imagen es demasiado pesada: el máximo permitido es 5MB');
  // El proxy (nginx) puede responder con HTML en vez de JSON cuando rechaza la petición
  let json: { error?: string; url?: string; data?: { url?: string } } | null = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok || !json) throw new Error(json?.error ?? `No se pudo subir la imagen (error ${res.status})`);
  return json.url ?? json.data?.url ?? '';
};

/** Certifica un código de descuento contra el backend (nunca lanza: devuelve el motivo). */
export const validarCodigoDescuento = async (
  guardedFetch: GuardedFetch,
  codigo: string,
): Promise<CodigoValidado> => {
  try {
    const res = await guardedFetch(`${API_ANUNCIOS}/codigos/${encodeURIComponent(codigo)}`);
    const json = await res.json();
    return res.ok ? json.data : { valido: false, codigo, motivo: json.error ?? 'Error al validar' };
  } catch {
    return { valido: false, codigo, motivo: 'No se pudo conectar con el servidor' };
  }
};
