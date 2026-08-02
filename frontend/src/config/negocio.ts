/**
 * Datos operativos del negocio que se muestran en la tienda (envíos, pagos,
 * muestras). Se centralizan aquí para editarlos en un solo lugar. Más adelante
 * pueden volverse configurables desde el dashboard.
 */
export const ENVIO = {
  cobertura: 'Envíos a todo Colombia',
  transportadoras: ['Interrapidísimo', 'Servientrega'],
  tiempo: '2 a 4 días hábiles',
  detalle: 'Llega hasta la puerta de tu casa.',
  contraentrega: false,
};

export const PAGOS = {
  // El pago es anticipado (antes de generar el pedido); no hay contraentrega.
  anticipado: true,
  metodos: ['Nequi', 'Bancolombia', 'Bre-B'],
};

/**
 * Garantía y devoluciones (ver `/legal#devoluciones`).
 *
 * El art. 8 de la Ley 1480 de 2011 deja que el vendedor ANUNCIE el término de
 * la garantía; solo a falta de anuncio son 12 meses. Se anuncian 90 días porque
 * es el mismo piso que la propia ley fija para productos usados — un número que
 * no nos inventamos y que es fácil de defender. Bajarlo mucho más se acerca a
 * "limitar la responsabilidad legal", que el art. 43 declara ineficaz.
 *
 * `AVISO_ENTREGA_DIAS` es OTRA cosa: el plazo para avisar que el pedido llegó
 * mal, y sirve para poder reclamarle a la transportadora. NO recorta la
 * garantía por defecto de fábrica (eso sería una cláusula abusiva).
 */
export const GARANTIA = {
  dias: 90,
  texto: 'noventa (90) días calendario',
  avisoEntregaDias: 5,
};

/**
 * INTERNO — NO mostrar en la web. Las muestras de regalo son un detalle interno
 * (solo si hay envases disponibles), no una promesa pública.
 */
export const MUESTRAS_INTERNO = 'Muestras de regalo según disponibilidad de envases.';
