export interface CreateComboDTO {
  nombre: string;
  descripcion?: string;
  imagen_url?: string;
  categoria_id?: number;
  presentacion_id?: number | null;
  cantidad: number;
  precio: number;
  descuento?: number;
  activo?: boolean;
  /** El kit: accesorios que trae por defecto. Ausente = no se toca el que tenía. */
  contenido?: { perfume_id: number; cantidad: number }[];
}
