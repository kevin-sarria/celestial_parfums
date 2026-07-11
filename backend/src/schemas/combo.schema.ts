import { z } from 'zod/v4';

export const createComboSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  descripcion: z.string().max(5000).optional(),
  imagen_url: z.string().url().optional().or(z.literal('')),
  categoria_id: z.number().int().positive().nullable().optional(),
  cantidad: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  precio: z.number().min(0, 'El precio no puede ser negativo'),
  descuento: z.number().int().min(0).max(100).optional(),
  activo: z.boolean().optional(),
});

export const patchDescuentoComboSchema = z.object({
  descuento: z.number().int().min(0).max(100),
});

export type CreateComboInput = z.infer<typeof createComboSchema>;
