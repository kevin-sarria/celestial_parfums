export interface CreateVentaDTO {
  dia: string;
  persona: string;
  cliente_id?: number | null;
  cantidad_perfumes: number;
  presentacion: string;
  referencia_perfume: string;
  valor_venta: number;
  datos_adicionales?: string;
}
