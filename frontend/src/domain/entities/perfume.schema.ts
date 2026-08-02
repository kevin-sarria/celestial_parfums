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

/** Lo que vale el perfume en una presentación concreta (ej: 30ml → 22.000). */
export const precioPresentacionSchema = z.object({
  presentacion: z.string(),
  precio: z.number(),
  /** true = precio exclusivo de este perfume, no el estándar de su categoría */
  propio: z.boolean().default(false),
      presentacion_id: z.number().default(0),
      envase_insumo_id: z.number().nullable().default(null),
      accesorios: z.array(z.number()).default([]),
});

export type PrecioPresentacion = z.infer<typeof precioPresentacionSchema>;

export const perfumeSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  /** El más barato de sus presentaciones (el "desde $X" de las cards). */
  precio: z.number(),
  precios: z.array(precioPresentacionSchema).default([]),
  /** true = sus presentaciones no valen lo mismo; la card muestra "desde". */
  varios_precios: z.boolean().default(false),
  /** Contratipo de esencia premium: distintivo propio y nunca entra en combos. */
  esencia_premium: z.boolean().default(false),
  /** Esencia concreta del perfume y su costo real por ml (solo admin lo usa). */
  insumo_esencia_id: z.number().nullable().default(null),
  insumo_esencia_nombre: z.string().nullable().default(null),
  insumo_esencia_precio: z.number().nullable().default(null),
  tipo_producto: z.enum(['fabricado', 'comprado', 'fraccionado']).default('fabricado'),
  insumo_producto_id: z.number().nullable().default(null),
  ml_utiles: z.number().nullable().default(null),
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
  /** Promedio (0-5) y total de reseñas aprobadas. */
  rating_promedio: z.number().default(0),
  rating_total: z.number().default(0),
});

export type Perfume = z.infer<typeof perfumeSchema>;
