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
}
