/**
 * EL CATÁLOGO: perfumes, combos y sus precios de lista.
 *
 * Son las formas de lo que se VENDE. El precio efectivo no se calcula aquí:
 * llega ya resuelto del servidor (cascada de `mapPerfume`).
 */

export interface Lookup {
  id: number;
  nombre: string;
  /** Solo categorías: % de descuento general que heredan sus perfumes. */
  descuento?: number;
  /** Solo categorías: cuántos perfumes la usan (0 = se puede borrar sin mudar). */
  usos?: number;
  /** Solo tallas: los ml que el sistema le leyó al nombre. null = no es un tamaño. */
  ml?: number | null;
  /** Segunda línea bajo el nombre en la lista (explica algo del elemento). */
  nota?: string;
}

/**
 * Catálogo sin paginar. Responde `{ data: { data: [...] } }` (anidado) y con
 * `?page=` responde `{ data: [...] }`: se aceptan las dos formas a propósito,
 * porque las dos existen en la API (ver `arquitectura.md`).
 */
export interface CatalogoItem {
  id: number;
  nombre: string;
  insumo_esencia_id?: number | null;
}
export type CatalogoRespuesta = { data: { data: CatalogoItem[] } | CatalogoItem[] };

export interface PerfumeForm {
  nombre: string; descripcion: string; precio: string; duracion: string;
  proyeccion: string; imagen_url: string; genero: 'dama' | 'caballero' | 'unisex' | '';
  categoria_id: number | ''; tipos_aroma: number[]; ocasiones: number[]; presentaciones: number[];
  /** Contratipo hecho con la esencia de mayor calidad: distintivo y fuera de combos. */
  esencia_premium: boolean;
  /** Esencia concreta con la que se hace (define su costo real por ml). */
  insumo_esencia_id: number | '';
  /** Cómo se abastece: lo fabricas, lo compras hecho o lo fraccionas. */
  tipo_producto: 'fabricado' | 'comprado' | 'fraccionado';
  /** Insumo que ES el producto (comprado) o del que sale (fraccionado). */
  insumo_producto_id: number | '';
  /** Solo fraccionado: ml que de verdad se aprovechan de la botella. */
  ml_utiles: string;
  /** Los 1.1: solo se venden si ya están armados, no contra pedido. */
  solo_armado: boolean;
  /** Es un accesorio (perfumero, bolsa, tarjeta), no una fragancia. */
  es_accesorio: boolean;
  /** Frasco propio por talla (presentacion_id → insumo del envase). */
  envases_talla: Record<number, number | ''>;
  /** Precio propio por presentación (id → texto); vacío = usa la lista de su categoría. */
  precios_propios: Record<number, string>;
}

export const emptyPerfumeForm = (): PerfumeForm => ({
  nombre: '', descripcion: '', precio: '', duracion: '',
  proyeccion: '', imagen_url: '', genero: '', categoria_id: '',
  tipos_aroma: [], ocasiones: [], presentaciones: [],
  esencia_premium: false, insumo_esencia_id: '',
  tipo_producto: 'fabricado', insumo_producto_id: '', ml_utiles: '', solo_armado: false,
  es_accesorio: false,
  envases_talla: {},
  precios_propios: {},
});

/** Una fila de la lista de precios: lo que vale una presentación en una categoría. */
export interface PrecioLista {
  categoria_id: number;
  categoria: string;
  presentacion_id: number;
  presentacion: string;
  precio: number;
}

export interface ComboForm {
  nombre: string; descripcion: string; imagen_url: string;
  categoria_id: number | '';
  /** Presentación de los perfumes del combo ('' = cualquier tamaño). */
  presentacion_id: number | '';
  cantidad: string; precio: string;
  descuento: string; activo: boolean;
}

export const emptyComboForm = (): ComboForm => ({
  nombre: '', descripcion: '', imagen_url: '', categoria_id: '', presentacion_id: '',
  cantidad: '2', precio: '', descuento: '0', activo: true,
});
