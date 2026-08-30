/**
 * LAS PERSONAS: su ficha, su tarjeta de sellos y sus reclamos.
 *
 * Usuario, recompensas y devoluciones van juntos porque las tres pantallas
 * miran a la MISMA persona desde ángulos distintos, y al abrir un reclamo se
 * necesita su compra y su ficha a la vez.
 */

/** Persona del sistema: cuenta web real o ficha creada por el admin (sin_cuenta). */
export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol_id: number;
  rol: string | null;
  activo: boolean;
  telefono: string | null;
  direccion: string | null;
  cupo_base: number;
  sin_cuenta: boolean;
  /** Códigos de descuento emitidos y aún sin canjear. */
  codigos_activos: { codigo: string; titulo: string; descuento_pct: number }[];
  created_at: string;
}

export interface UsuarioForm {
  nombre: string; apellido: string; email: string;
  activo: boolean; password: string;
  telefono: string; direccion: string;
}

/** Tarjeta de recompensas de un cliente (calculada del historial). */
export interface TarjetaRecompensa {
  activo: boolean;
  objetivo: number;
  premio: string;
  min_compra: number;
  tiene_override: boolean;
  sellos: number;
  faltan: number;
  premio_listo: boolean;
  premios_listos: number;
  premios_entregados: number;
  sellos_historicos: number;
  colores: { fondo: string; lineas: string; texto: string };
}

export interface RecompensaConfig {
  activo: boolean;
  sellos_objetivo: number;
  premio: string;
  min_compra: number;
  color_fondo: string;
  color_lineas: string;
  color_texto: string;
}

export interface RecompensaClienteRow {
  id: number;
  nombre: string;
  apellido: string;
  correo: string | null;
  telefono: string | null;
  tarjeta: TarjetaRecompensa;
}

// ── Devoluciones y garantías ────────────────────────────────────────────────

export type DevolucionMotivo =
  | 'llego_danado' | 'llego_equivocado' | 'llego_incompleto'
  | 'envase_defectuoso' | 'no_llego' | 'otro';
export type DevolucionEstado = 'pendiente' | 'en_revision' | 'resuelta' | 'rechazada';
export type DevolucionSolucion = 'reposicion' | 'devolucion_dinero' | 'ninguna';

/** Venta candidata para engancharle una devolución (buscador del formulario). */
export interface VentaParaDevolucion {
  id: number;
  dia: string;
  persona: string;
  valor_venta: number;
  referencia_perfume: string;
  perfumes: { perfume_id: number; nombre: string; cantidad: number }[];
}

export interface Devolucion {
  id: number;
  venta_id: number;
  user_id: number | null;
  origen: 'admin' | 'cliente';
  fecha: string;
  motivo: DevolucionMotivo;
  detalle: string | null;
  estado: DevolucionEstado;
  solucion: DevolucionSolucion | null;
  monto_devuelto: number;
  fecha_resolucion: string | null;
  notas: string | null;
  reposicion_formula_id: number | null;
  reposicion_cantidad: number;
  /** Si el frasco volvió a manos del dueño, y si sirve para venderse otra vez. */
  producto_devuelto: boolean;
  revendible: boolean;
  costo_reposicion: number;
  costo_envio: number;
  /** Lo que TE costó la garantía: devuelto + repuesto + envío. */
  costo_total: number;
  imagenes: string[];
  venta: { id: number; dia: string; persona: string; valor_venta: number; referencia_perfume: string } | null;
  perfumes: { perfume_id: number; cantidad: number; nombre: string }[];
  created_at: string;
}
