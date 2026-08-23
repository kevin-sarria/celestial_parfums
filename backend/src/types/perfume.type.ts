export interface CreatePerfumeDTO {
  nombre: string;
  descripcion?: string;
  precio: number;
  duracion?: string;
  proyeccion?: string;
  imagen_url?: string;
  genero?: 'dama' | 'caballero' | 'unisex' | null;
  categoria_id?: number | null;
  descuento?: number;
  agotado?: boolean;
  publicado?: boolean;
  esencia_premium?: boolean;
  /** Esencia concreta con la que se hace (Eternity, Khamrah…). */
  insumo_esencia_id?: number | null;
  tipo_producto?: 'fabricado' | 'comprado' | 'fraccionado';
  insumo_producto_id?: number | null;
  ml_utiles?: number | null;
  /** "Solo se vende si ya está armado" (los 1.1). */
  solo_armado?: boolean;
  /** Marca que esta ficha es un accesorio (perfumero, bolsa, tarjeta), no una fragancia. */
  es_accesorio?: boolean;
  envases_talla?: { presentacion_id: number; envase_insumo_id?: number | null; accesorios?: number[] }[];
  tipos_aroma: number[];
  ocasiones: number[];
  presentaciones: number[];
  /** Precios que se salen de la lista estándar, por presentación. */
  precios_propios?: { presentacion_id: number; precio: number }[];
}