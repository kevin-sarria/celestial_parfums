import { z } from 'zod';

export const comboSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  imagen_url: z.string().nullable(),
  categoria_id: z.number().nullable(),
  categoria: z.string().nullable(),
  /** Presentación de los perfumes del combo; null = cualquier tamaño. */
  presentacion_id: z.number().nullable().optional().default(null),
  presentacion: z.string().nullable().optional().default(null),
  cantidad: z.number(),
  precio: z.number(),
  descuento: z.number(),
  activo: z.boolean(),
  /** El kit del combo: accesorios que trae por defecto (se ofrecen como regalo al vender). */
  contenido: z.array(z.object({
    perfume_id: z.number(),
    nombre: z.string(),
    cantidad: z.number(),
    publicado: z.boolean(),
  })).optional().default([]),
});

export type Combo = z.infer<typeof comboSchema>;
