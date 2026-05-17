export interface CreateCreditoDTO {
  fecha: string;
  cliente_id: number;
  articulos: string;
  deuda_inicial: number;
}

export interface AddAbonoDTO {
  monto: number;
}
