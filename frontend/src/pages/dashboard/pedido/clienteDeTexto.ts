/**
 * Reconocer al cliente por el nombre que se escribió en la venta.
 *
 * El dueño escribe "Gerardo Arias" en *Persona* y casi nunca abre el desplegable
 * de *Cliente enlazado*: medido el 2026-10-04, **225 de 342 ventas estaban sin
 * cliente** (y solo 4 de esos nombres coincidían con una cuenta). La regla del
 * negocio no se puede recordar en cada venta, así que se ofrece sola.
 */

/** Sin tildes, sin mayúsculas y con un solo espacio: "  Gerardo  ARIAS " = "gerardo arias". */
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Cuántas letras hacen falta para adivinar.
 *
 * Con "Ana" se enlazaría a cualquier Ana: un enlace equivocado mezcla dos
 * historiales y ni se nota. Con 5 letras el nombre ya distingue.
 */
export const MIN_LETRAS = 5;

/** El cliente cuyo nombre completo escrito coincide EXACTO con lo tecleado. */
export const buscarClientePorNombre = <T extends { nombre: string; apellido: string }>(
  clientes: T[],
  texto: string,
): T | undefined => {
  const buscado = normalizar(texto);
  if (buscado.length < MIN_LETRAS) return undefined;
  return clientes.find((c) => normalizar(`${c.nombre} ${c.apellido}`) === buscado);
};

/**
 * "Gerardo Arias" → nombre "Gerardo", apellido "Arias".
 *
 * Se parte por el primer espacio y el resto queda de apellido: "Ana María López"
 * da nombre "Ana" y apellido "María López", que es como lo lee el dueño.
 */
export const partirNombre = (texto: string): { nombre: string; apellido: string } => {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombre: partes[0] ?? '', apellido: '' };
  return { nombre: partes[0], apellido: partes.slice(1).join(' ') };
};
