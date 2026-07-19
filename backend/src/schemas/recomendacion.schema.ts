import { z } from 'zod/v4';

/**
 * Respuestas del quiz "Tu perfume ideal". Todo es opcional: cada criterio
 * respondido entra al cálculo de afinidad; los omitidos no penalizan.
 */
export const filtrosRecomendacionSchema = z.object({
  genero: z.enum(['dama', 'caballero', 'unisex']).nullish(),
  edad: z.enum(['18-25', '26-35', '36-50', '50+']).nullish(),
  // Ids de ocasiones y tipos de aroma del catálogo
  ocasiones: z.array(z.number().int().positive()).max(30).optional(),
  aromas: z.array(z.number().int().positive()).max(30).optional(),
  // Ids de categorías (Original / 1.1 / Contratipo)
  categorias: z.array(z.number().int().positive()).max(20).optional(),
  // Presupuesto máximo en COP (null = sin límite)
  presupuesto: z.number().positive().nullish(),
  intensidad: z.enum(['suave', 'media', 'fuerte']).nullish(),
});

export type FiltrosRecomendacion = z.infer<typeof filtrosRecomendacionSchema>;
