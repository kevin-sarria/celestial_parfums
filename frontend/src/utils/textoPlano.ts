/**
 * La descripción como texto de una línea: para lo que no entiende formato
 * (una tarjeta recortada a 2 renglones, la búsqueda, la etiqueta de Google).
 */
export const textoPlano = (html: string | null | undefined): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html.replace(/<\/(p|li|h[2-4])>|<br\s*\/?>/gi, ' $&'), 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
};
