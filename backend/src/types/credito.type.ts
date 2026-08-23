export interface CreateCreditoDTO {
  fecha: string;
  user_id: number;
  articulos: string;
  // Valor de los productos ANTES del cupón (si hay); la deuda real se calcula
  // aplicando el descuento del código.
  deuda_inicial: number;
  // Perfumes del catálogo elegidos (ids REPETIDOS por cantidad). Si viene, se
  // usan directo; si no (importador), se infieren del texto de artículos.
  perfume_ids?: number[];
  // Resumen de presentaciones vendidas (ej: "30ml, 60ml"); se guarda en la venta.
  presentacion?: string | null;
  // Código de descuento a canjear en este crédito (opcional). Se consume al crear.
  codigo_descuento?: string | null;
  // Acuerdo de pago (AAAA-MM-DD); si se omite, 1 mes desde `fecha`.
  fecha_limite?: string | null;
}

export interface AddAbonoDTO {
  monto: number;
}
