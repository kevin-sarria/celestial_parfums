/** Tipos del módulo de cotizaciones mayoristas (B2B, solo admin). */

export type InsumoTipo = 'materia_prima' | 'envase' | 'accesorio';
export type InsumoUnidad = 'ml' | 'unidad';
/** unidad = uno por perfume; pedido = uno por envío completo. */
export type InsumoAlcance = 'unidad' | 'pedido';

export interface Insumo {
  id: number;
  nombre: string;
  tipo: InsumoTipo;
  unidad: InsumoUnidad;
  alcance: InsumoAlcance;
  /** Costo por ml (materias primas) o por pieza (envases/accesorios). */
  precio: number;
  activo: boolean;
  /** Gama de la esencia. Null en envases, accesorios y el resto de materias primas. */
  gama_id?: number | null;
  gama_nombre?: string | null;
}

export interface EscalaPrecio {
  id: number;
  formula_volumen_id: number;
  cantidad_min: number;
  /** null = sin tope superior (el "100+"). */
  cantidad_max: number | null;
  precio: number;
}

export interface FormulaVolumen {
  id: number;
  nombre: string;
  ml_total: number;
  esencia_ml: number;
  sellador_ml: number;
  feromonas_ml: number;
  /** Calculado por el backend: ml_total − esencia − sellador − feromonas. */
  diluyente_ml: number;
  envase_insumo_id: number | null;
  envase_nombre: string | null;
  envase_precio: number | null;
  /** Esencia concreta de esta receta (normal, premium…). */
  esencia_insumo_id: number | null;
  esencia_nombre: string | null;
  esencia_precio: number | null;
  activo: boolean;
  orden: number;
  escalas: EscalaPrecio[];
  /** Accesorios que este tamaño incluye por defecto (punto de partida al cotizar). */
  accesorios_default: AccesorioSeleccionado[];
}

/** Costo interno por unidad. SOLO admin: nunca viaja al PDF del cliente. */
export interface DesgloseCosto {
  esencia: number;
  diluyente: number;
  sellador: number;
  feromonas: number;
  envase: number;
  accesorios: number;
  costo_unitario: number;
}

export interface AccesorioSeleccionado {
  insumo_id: number;
  nombre: string;
  precio: number;
}

export interface CondicionesComerciales {
  pedido_minimo: string;
  tiempo_preparacion: string;
  tiempo_despacho: string;
  forma_pago: string;
  condiciones_pago: string;
  costos_envio: string;
  garantias: string;
  politica_cambios: string;
}

export interface CotizacionConfig {
  vigencia_dias_default: number;
  condiciones_comerciales: CondicionesComerciales;
  beneficios_items: string[];
  avisos_legales: string[];
}

export interface CotizacionItem {
  id?: number;
  perfume_id: number | null;
  perfume_nombre: string;
  perfume_imagen?: string | null;
  formula_volumen_id: number | null;
  volumen_nombre: string;
  cantidad: number;
  accesorios_seleccionados: AccesorioSeleccionado[];
  desglose_costo: DesgloseCosto;
  precio_unitario: number;
  subtotal: number;
}

/** Lista de precios por cantidad (cotización general, sin fragancias concretas). */
export interface ListaPreciosVolumen {
  volumen_nombre: string;
  escalas: { desde: number; hasta: number | null; precio: number }[];
}

export type CotizacionTipo = 'general' | 'detallada';

export interface Cotizacion {
  id: number;
  numero: string;
  tipo: CotizacionTipo;
  lista_precios: ListaPreciosVolumen[] | null;
  /** Insumos de alcance "pedido" cargados una sola vez (caja de envío…). */
  extras_pedido: AccesorioSeleccionado[];
  cliente_nombre: string;
  cliente_empresa: string | null;
  cliente_telefono: string | null;
  cliente_email: string | null;
  cliente_nit: string | null;
  plantilla_id: number | null;
  subtotal: number;
  descuento_pct: number;
  total: number;
  vigencia_dias: number;
  fecha_vigencia: string;
  condiciones_comerciales: CondicionesComerciales;
  observaciones: string | null;
  estado: 'borrador' | 'enviada';
  fecha: string;
  items: CotizacionItem[];
}

/** Rentabilidad de una línea o del total (solo admin). */
export interface Rentabilidad {
  costoTotal: number;
  ingresoTotal: number;
  utilidad: number;
  /** Margen sobre la venta, en %. */
  margenPct: number;
}
