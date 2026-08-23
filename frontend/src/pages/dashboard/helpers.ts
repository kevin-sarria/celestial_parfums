import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
import type { ClienteSeleccion, CodigoValidado, Lookup } from './types';

export { formatPrice } from '@/lib/format';

export const DEFAULT_PAGE_SIZE = 10;

/**
 * Fechas de calendario (día de una venta, crédito, pago o vigencia de un anuncio):
 * el backend las manda como AAAA-MM-DD y se leen tal cual. NO usar `new Date()`
 * aquí: interpretaría el día como medianoche UTC y en Colombia (UTC-5) mostraría
 * el día anterior (una venta del 22 aparecía como 21).
 */
export const fmtDate = (d: string) => {
  const [y, m, dia] = d.slice(0, 10).split('-');
  return `${Number(dia)}/${Number(m)}/${y}`;
};

/** Marcas de tiempo reales (registro de un usuario, emisión de un código): sí van a hora local. */
export const fmtInstante = (d: string) => new Date(d).toLocaleDateString('es-CO');

/** Interpreta el valor crudo del desplegable de persona enlazada. */
export const parseClienteSeleccion = (val: string): ClienteSeleccion =>
  val === '' || val === 'nuevo' ? val : Number(val);

/** Etiqueta legible de una persona en desplegables (oculta emails sintéticos de fichas). */
export const personaLabel = (u: { nombre: string; apellido: string; telefono: string | null; email: string; sin_cuenta: boolean }) => {
  const contacto = u.sin_cuenta ? (u.telefono ?? 'sin cuenta web') : u.email;
  return `${u.nombre} ${u.apellido} · ${contacto}`;
};

/** Sube una imagen del admin y devuelve su URL pública (lanza Error si falla). */
export const subirImagenAdmin = async (file: File, endpoint: string = urls.upload): Promise<string> => {
  const fd = new FormData();
  fd.append('image', file);
  const res = await http.subir<{ url?: string; data?: { url?: string } }>(endpoint, fd);
  // 413 lo corta el proxy (nginx) antes de llegar al backend: no trae mensaje propio.
  if (res.status === 413) throw new Error('La imagen es demasiado pesada: el máximo permitido es 5MB');
  if (!res.ok || !res.cuerpo) throw new Error(res.error || 'No se pudo subir la imagen');
  return res.cuerpo.url ?? res.cuerpo.data?.url ?? '';
};

/**
 * Deja escrito bajo cada talla qué tamaño le leyó el sistema.
 *
 * El número sale del nombre al crearla o renombrarla, y de él dependen el enlace
 * con la receta y el costeo. Sin mostrarlo, una talla que quedó "sin tamaño"
 * solo se descubre meses después, cuando su venta entró con costo cero.
 */
export const conNotaDeTalla = (tallas: Lookup[]): Lookup[] =>
  tallas.map((t) => ({
    ...t,
    nota: t.ml != null
      ? `${t.ml} ml`
      : 'Sin tamaño: el sistema no la costea ni le enlaza receta',
  }));

/** Certifica un código de descuento contra el backend (nunca lanza: devuelve el motivo). */
export const validarCodigoDescuento = async (codigo: string): Promise<CodigoValidado> => {
  const res = await http.get<{ data: CodigoValidado }>(urls.anuncios.codigo(codigo));
  return res.ok && res.cuerpo
    ? res.cuerpo.data
    : { valido: false, codigo, motivo: res.error };
};
