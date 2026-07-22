import { z } from 'zod/v4';

export const createVentaSchema = z.object({
  dia: z.string().min(1, 'El día es obligatorio'),
  persona: z.string().min(1, 'La persona es obligatoria').max(150),
  // Enlace opcional con la persona registrada (usuario o ficha)
  user_id: z.number().int().positive().nullable().optional(),
  cantidad_perfumes: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  presentacion: z.string().min(1, 'La presentación es obligatoria').max(100),
  // Solo perfumes del catálogo: al menos uno (una venta de combo lleva varios)
  perfume_ids: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un perfume del catálogo'),
  valor_venta: z.number().positive('El valor debe ser mayor a 0'),
  // Es un dato EXTRA: se acepta texto, null o ausente
  datos_adicionales: z.string().max(5000).nullish(),
  // false = pendiente de pago (el código de descuento queda reservado, no canjeado)
  pagada: z.boolean().optional(),
  // Código único de descuento del pedido de WhatsApp (se canjea al pagar)
  codigo_descuento: z.string().max(20).nullish(),
});

export type CreateVentaInput = z.infer<typeof createVentaSchema>;
