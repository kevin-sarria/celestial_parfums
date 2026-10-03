import sanitizeHtml from 'sanitize-html';
import { z } from 'zod/v4';

/**
 * TEXTO CON FORMATO: el blog y las descripciones (perfumes, combos, Contáctame).
 *
 * Nació en el blog. Desde el 2026-10-02 (opción B del dueño: editor tipo Word
 * en vez de asteriscos) las descripciones usan el mismo editor y por eso las
 * reglas viven aquí, en un solo sitio.
 *
 * El HTML llega de un `contentEditable` y NUNCA se confía en él: se sanea al
 * guardar y otra vez al leer. Al leer porque hay descripciones viejas que
 * nunca pasaron por aquí (texto plano, o lo que trajera una importación), y la
 * tienda las pinta como HTML.
 */
const OPCIONES_SANEO: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'hr'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Fuerza rel seguro en enlaces que abren en otra pestaña
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
  },
};

export const sanearHtml = (html: string) => sanitizeHtml(html ?? '', OPCIONES_SANEO);

/** ¿Ya es HTML del editor, o es texto de antes del editor? */
const pareceHtml = (t: string) => /<(p|br|strong|b|em|i|u|s|h[2-4]|ul|ol|li|blockquote|a)\b[^>]*>/i.test(t);

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Texto de antes del editor → HTML.
 *
 * El dueño ya escribía `**negrita**` esperando que saliera en negrita (y la
 * tienda le mostraba los asteriscos). Se respeta eso, junto con los saltos de
 * línea: una línea en blanco separa párrafos y un salto simple es un `<br>`.
 */
const textoAHtml = (t: string) =>
  escapar(t.replace(/\r\n?/g, '\n').trim())
    .split(/\n\s*\n/)
    .map((parrafo) => `<p>${parrafo
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')}</p>`)
    .join('');

/** Lo que se le entrega a la tienda: siempre HTML limpio, o null si no hay nada. */
export const descripcionHtml = (t: string | null | undefined): string | null => {
  if (!t?.trim()) return null;
  const html = sanearHtml(pareceHtml(t) ? t : textoAHtml(t));
  return textoPlano(html) ? html : null;
};

/**
 * HTML → texto de una línea, para lo que no entiende formato: la descripción
 * que Google y WhatsApp muestran al compartir un enlace, y las búsquedas.
 */
export const textoPlano = (html: string | null | undefined): string => {
  if (!html) return '';
  const sinEtiquetas = sanitizeHtml(html.replace(/<\/(p|li|h[2-4])>|<br\s*\/?>/gi, ' '), {
    allowedTags: [], allowedAttributes: {},
  });
  return sinEtiquetas
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * El campo de descripción de un formulario: se guarda ya saneado, y uno que
 * solo trae etiquetas vacías (el `<br>` que deja el editor al borrarlo todo)
 * se guarda como vacío. `max` es sobre el HTML, que pesa más que el texto.
 */
export const campoDescripcion = (max = 5000) =>
  z.string().max(max, `La descripción es demasiado larga (máximo ${max} caracteres con formato)`)
    .transform((v) => (textoPlano(v) ? sanearHtml(v) : ''))
    .nullish();
