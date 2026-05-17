export interface CreatePerfumeDTO {
  nombre: string;
  descripcion?: string;
  precio: number;
  duracion?: string;
  proyeccion?: string;
  imagen_url?: string;
  genero?: 'hombre' | 'mujer' | null;
  categoria_id?: number | null;
  descuento?: number;
  agotado?: boolean;
  tipos_aroma: number[];
  ocasiones: number[];
  presentaciones: number[];
}