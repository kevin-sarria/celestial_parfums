import { z } from 'zod';

export const GENEROS = ['dama', 'caballero', 'unisex'] as const;
export type Genero = (typeof GENEROS)[number];

// ︎ fuerza presentación de TEXTO: sin él, iOS dibuja ♀/♂ como emoji
// (ignora el color y tamaño del CSS).
export const GENERO_LABELS: Record<Genero, string> = {
  dama: '♀︎ Dama',
  caballero: '♂︎ Caballero',
  unisex: '⚥︎ Unisex',
};

export const GENERO_SYMBOLS: Record<Genero, string> = {
  dama: '♀︎',
  caballero: '♂︎',
  unisex: '⚥︎',
};

export const perfumeSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  precio: z.number(),
  duracion: z.string().nullable(),
  proyeccion: z.string().nullable(),
  imagen_url: z.string().nullable(),
  genero: z.enum(GENEROS).nullable(),
  categoria: z.string().nullable(),
  categoria_id: z.number().nullable(),
  // % efectivo (el mayor entre el propio y el general de su categoría)
  descuento: z.number(),
  // % propio del perfume, sin contar el de la categoría (lo usa el dashboard)
  descuento_propio: z.number().optional(),
  agotado: z.boolean().default(false),
  // true durante los primeros 30 días del perfume en el catálogo
  es_nuevo: z.boolean().default(false),
  tipos_aroma: z.array(z.string()),
  ocasiones: z.array(z.string()),
  presentaciones: z.array(z.string()),
});

export type Perfume = z.infer<typeof perfumeSchema>;
