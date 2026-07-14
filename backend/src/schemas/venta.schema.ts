import { z } from 'zod/v4';

export const createVentaSchema = z.object({
  dia: z.string().min(1, 'El día es obligatorio'),
  persona: z.string().min(1, 'La persona es obligatoria').max(150),
  cliente_id: z.number().int().positive().nullable().optional(),
  cantidad_perfumes: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  presentacion: z.string().min(1, 'La presentación es obligatoria').max(20),
  referencia_perfume: z.string().min(1, 'La referencia es obligatoria'),
  valor_venta: z.number().positive('El valor debe ser mayor a 0'),
  datos_adicionales: z.string().max(5000).optional(),
});

export type CreateVentaInput = z.infer<typeof createVentaSchema>;
