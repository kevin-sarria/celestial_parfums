export interface CreateVentaDTO {
  dia: string;
  persona: string;
  user_id?: number | null;
  cantidad_perfumes: number;
  presentacion: string;
  /** Perfumes del catálogo incluidos en la venta (al menos uno). */
  perfume_ids: number[];
  valor_venta: number;
  datos_adicionales?: string | null;
  /** false = pendiente de pago; al pasar a true se canjea el código enlazado. */
  pagada?: boolean;
  /** Código único de descuento recibido en el pedido de WhatsApp. */
  codigo_descuento?: string | null;
}
