import { z } from 'zod/v4';

export const createPagoSchema = z.object({
  dia: z.string().min(1, 'El día es obligatorio'),
  empresa_id: z.number().int().positive('La empresa es obligatoria'),
  valor_compra: z.number().positive('El valor debe ser mayor a 0'),
  coste_envio: z.number().min(0).optional(),
  detalles_adicionales: z.string().max(5000).nullish(),
});

export type CreatePagoInput = z.infer<typeof createPagoSchema>;
