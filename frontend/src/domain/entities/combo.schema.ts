import { z } from 'zod';

export const comboSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  imagen_url: z.string().nullable(),
  categoria_id: z.number().nullable(),
  categoria: z.string().nullable(),
  cantidad: z.number(),
  precio: z.number(),
  descuento: z.number(),
  activo: z.boolean(),
});

export type Combo = z.infer<typeof comboSchema>;
