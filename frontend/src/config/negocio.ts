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
 * INTERNO — NO mostrar en la web. Las muestras de regalo son un detalle interno
 * (solo si hay envases disponibles), no una promesa pública.
 */
export const MUESTRAS_INTERNO = 'Muestras de regalo según disponibilidad de envases.';
