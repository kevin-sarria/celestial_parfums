import { z } from 'zod';

export const perfumeSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  precio: z.number(),
  duracion: z.string().nullable(),
  proyeccion: z.string().nullable(),
  imagen_url: z.string().nullable(),
  genero: z.enum(['hombre', 'mujer']).nullable(),
  categoria: z.string().nullable(),
  categoria_id: z.number().nullable(),
  descuento: z.number(),
  agotado: z.boolean().default(false),
  tipos_aroma: z.array(z.string()),
  ocasiones: z.array(z.string()),
  presentaciones: z.array(z.string()),
});

export type Perfume = z.infer<typeof perfumeSchema>;
