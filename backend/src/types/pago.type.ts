export interface CreatePagoDTO {
  dia: string;
  empresa_id: number;
  valor_compra: number;
  coste_envio?: number;
  detalles_adicionales?: string;
}
