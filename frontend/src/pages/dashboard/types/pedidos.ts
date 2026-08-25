import { fechaLimitePorDefecto, hoy } from '../../../utils/fechas';
import type { LineaPedido } from '../pedido/lineasPedido';

/**
 * VENTAS Y CRÉDITOS: lo que el dueño registra en el mostrador.
 *
 * Van juntos porque son el mismo pedido cobrado de dos formas: comparten el
 * armador de líneas (`LineaPedido`), el selector de cliente y el cupón. El
 * crédito además arrastra su perfil crediticio y su acuerdo de pago.
 */

/** Perfil crediticio interno calculado por el backend (SOLO admin). */
export interface PerfilCredito {
  user_id: number;
  nombre: string;
  cupo_base: number;
  factor: number;
  cupo: number;
  deuda_total: number;
  cupo_disponible: number;
  vetado: boolean;
  tiene_credito_activo: boolean;
  eventos: { tipo: 'pago_rapido' | 'pago_lento' | 'cupon_vencido' | 'veto'; credito_id: number; detalle: string }[];
  creditos: {
    id: number; fecha: string; articulos: string; deuda_inicial: number;
    abonado: number; saldo: number; dias_sin_abono: number;
    abonos: { monto: number; fecha: string }[];
  }[];
}

export interface Venta {
  id: number;
  dia: string;
  persona: string;
  user_id: number | null;
  user: { id: number; nombre: string; apellido: string; telefono: string | null; email: string } | null;
  cantidad_perfumes: number;
  presentacion: string;
  referencia_perfume: string;
  /** Perfumes del catálogo incluidos en la venta (un combo lleva varios; cantidad = unidades de esa fragancia). */
  /** `regalo` = cuántas de esas unidades fueron sin cobrar (0 en las históricas). */
  perfumes: { id: number; nombre: string; ml: number | null; cantidad: number; regalo: number }[];
  valor_venta: number;
  datos_adicionales: string | null;
  /** false = pendiente de pago; al marcarla pagada se canjea el código enlazado. */
  pagada: boolean;
  /** Código único de descuento enlazado al pedido (si lo hubo). */
  codigo: { codigo: string; estado: 'activo' | 'canjeado' | 'anulado'; titulo: string; descuento_pct: number } | null;
}

export interface CreditoAbono {
  id: number;
  monto: number;
  fecha: string;
}

export interface Credito {
  id: number;
  fecha: string;
  /** Acuerdo de pago: fecha límite pactada (por defecto, 30 días desde la fecha). */
  fecha_limite: string | null;
  /** La persona (usuario o ficha) dueña del crédito. */
  cliente: {
    id: number; nombre: string; apellido: string;
    telefono: string | null; correo: string | null; direccion: string | null;
    sin_cuenta?: boolean;
  };
  articulos: string;
  deuda_inicial: number;
  abonos: CreditoAbono[];
  total_abonado: number;
  total_en_deuda: number;
  /** true = sigue con saldo pasada la fecha límite. */
  vencido: boolean;
  /** Cupón canjeado en este crédito (si lo hubo). */
  codigo: { codigo: string; descuento_pct: number; max_descuento: number; titulo: string } | null;
  /** Resumen de presentaciones de la venta enlazada (para reconstruir el editor). */
  presentacion: string;
  /** Perfumes enlazados con su cantidad (para reconstruir las líneas al editar). */
  /** Las líneas guardadas, con su talla y su regalo: el editor las reconstruye tal cual. */
  productos: { perfume_id: number; cantidad: number; ml: number | null; regalo: number }[];
  /** Venta enlazada: nace pendiente con el crédito y se paga al saldarlo. */
  venta: { id: number; pagada: boolean } | null;
}

/**
 * Valor del desplegable de persona enlazada en ventas/créditos:
 * número = usuario/ficha existente, 'nuevo' = crear ficha, '' = sin enlace.
 */
export type ClienteSeleccion = number | 'nuevo' | '';

export interface VentaForm {
  dia: string; persona: string; cantidad_perfumes: string;
  presentacion: string; valor_venta: string;
  datos_adicionales: string;
  /** Perfumes del catálogo seleccionados (al menos uno). */
  perfume_ids: number[];
  /**
   * Líneas de la venta: producto + talla + cantidad. Es la forma nueva; sin la
   * talla por línea es imposible saber qué receta descontar del inventario.
   * `ml` en null = producto sin talla (una gorra).
   */
  lineas: { perfume_id: number; nombre: string; ml: number | null; cantidad: number }[];
  user_id: ClienteSeleccion;
  /** false = pendiente de pago (el código queda reservado, no canjeado). */
  pagada: boolean;
  /** Código único de descuento recibido en el pedido de WhatsApp. */
  codigo_descuento: string;
  nuevo_nombre: string; nuevo_apellido: string; nuevo_correo: string;
  nuevo_telefono: string; nuevo_direccion: string;
}

export const emptyVentaForm = (): VentaForm => ({
  dia: hoy(),
  persona: '', cantidad_perfumes: '1', presentacion: '30ML',
  valor_venta: '', datos_adicionales: '',
  perfume_ids: [], lineas: [],
  user_id: '',
  pagada: true,
  codigo_descuento: '',
  nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '',
  nuevo_telefono: '', nuevo_direccion: '',
});

/** Una línea del crédito: un perfume con su talla, cantidad y si lleva descuento. */
/**
 * La línea de un crédito es la misma que la de una venta: ambas pantallas
 * comparten el armador de pedido. El tipo vive en `pedido/lineasPedido.ts`.
 */
export type { LineaPedido };

export interface CreditoForm {
  fecha: string; user_id: ClienteSeleccion;
  nuevo_nombre: string; nuevo_apellido: string; nuevo_correo: string;
  nuevo_telefono: string; nuevo_direccion: string;
  /** Texto de artículos: se arma solo con las líneas (o se edita a mano). */
  articulos: string; deuda_inicial: string;
  /** Productos del crédito (editor de líneas). */
  lineas: LineaPedido[];
  /** true = aplicar precio de combo (mayoreo) a este crédito. */
  aplicar_combo: boolean;
  /** true = la deuda se editó a mano; deja de recalcularse desde las líneas. */
  deuda_manual: boolean;
  /** Fecha límite pactada (por defecto, 30 días desde la fecha). */
  fecha_limite: string;
  /** Código de descuento a canjear en el crédito (opcional). */
  codigo_descuento: string;
}

/**
 * El plazo por defecto del acuerdo de pago vive en `utils/fechas.ts`, con su
 * porqué. Se re-exporta aquí para no romper a quien ya lo importaba de este
 * archivo. Se llamaba `unMesDespues` y el nombre mentía desde que el plazo se
 * cuenta en días: el 31 de enero le daba el 3 de MARZO.
 */
export { fechaLimitePorDefecto } from '../../../utils/fechas';

export const emptyCreditoForm = (): CreditoForm => {
  const dia = hoy();
  return {
    fecha: dia,
    user_id: '',
    nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '',
    nuevo_telefono: '', nuevo_direccion: '',
    articulos: '', deuda_inicial: '',
    lineas: [], aplicar_combo: false, deuda_manual: false,
    fecha_limite: fechaLimitePorDefecto(dia),
    codigo_descuento: '',
  };
};
