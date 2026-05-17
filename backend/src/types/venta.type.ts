export interface CreateVentaDTO {
  dia: string;
  persona: string;
  cantidad_perfumes: number;
  presentacion: string;
  referencia_perfume: string;
  valor_venta: number;
  datos_adicionales?: string;
}
