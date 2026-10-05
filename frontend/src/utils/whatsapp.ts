/**
 * El WhatsApp de un cliente, en UN solo sitio.
 *
 * Nació de una inconsistencia medida el 2026-10-04: Reposiciones ya abría el chat
 * directo (`wa.me/57…`) y la recompra no (`wa.me/?text=`), así que el dueño tenía
 * que buscar el contacto a mano justo en la pantalla que existe para escribirle.
 *
 * Los teléfonos se guardan como los teclea el dueño —con espacios, guiones o el
 * `+57` delante—, así que aquí se limpian y se les pone el indicativo una sola vez.
 */
export const telefonoWa = (tel: string | null | undefined): string | null => {
  const digitos = (tel ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  // Un celular colombiano son 10 dígitos; con el indicativo, 12. Si ya lo trae
  // escrito, no se le suma otro.
  return digitos.length <= 10 ? `57${digitos}` : digitos;
};

/**
 * Enlace al chat del cliente. Sin teléfono cae al selector de contactos de
 * WhatsApp y el dueño elige a quién —el mensaje va escrito igual—, que es el
 * comportamiento que había antes de que existiera el teléfono.
 */
export const waLink = (tel: string | null | undefined, texto: string): string => {
  const numero = telefonoWa(tel);
  const mensaje = encodeURIComponent(texto);
  return numero ? `https://wa.me/${numero}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`;
};
