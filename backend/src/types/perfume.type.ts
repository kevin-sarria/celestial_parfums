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
  esencia_premium?: boolean;
  tipos_aroma: number[];
  ocasiones: number[];
  presentaciones: number[];
  /** Precios que se salen de la lista estándar, por presentación. */
  precios_propios?: { presentacion_id: number; precio: number }[];
}