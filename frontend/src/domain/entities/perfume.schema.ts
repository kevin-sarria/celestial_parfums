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
  /**
   * Número real de la talla, para saber qué receta descontar del inventario.
   * Null en las entradas que no son una talla ("Combo Personalizado").
   */
  ml: z.number().nullable().default(null),
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
  /** Existencias de su esencia: con esto se sabe si hoy se puede armar uno. */
  insumo_esencia_stock: z.number().nullable().default(null),
  /**
   * Gama HEREDADA de su esencia (árabe, clásica, premium…). No es una columna
   * del perfume: sale de la esencia a la que está enlazado, así que
   * reclasificar una esencia mueve sus perfumes solos. Null = todavía sin
   * esencia asignada; ese perfume no se puede segmentar por gama.
   */
  gama: z.string().nullable().default(null),
  gama_id: z.number().nullable().default(null),
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
  /**
   * Lo que ve la tienda: lo marcó el dueño **o** no alcanza la esencia para
   * armar ni uno. Lo calcula el servidor en cada consulta; no hay ninguna
   * columna que diga esto, a propósito (un valor guardado quedaría mintiendo
   * en cuanto entre una compra de esencia).
   */
  agotado: z.boolean().default(false),
  /** La marca manual, cruda: es lo único que el dashboard puede desmarcar. */
  agotado_manual: z.boolean().default(false),
  /** Se quedó sin esencia para armar ni uno de su talla más pequeña. */
  sin_esencia: z.boolean().default(false),
  /** Cuánta esencia pide una unidad de su talla más pequeña, para explicarlo. */
  esencia_necesaria: z.number().nullable().default(null),
  /**
   * Qué le falta EXACTAMENTE para poder venderse, porque las tres categorías no
   * se consiguen igual: al contratipo le falta esencia, al 1.1 le faltan frascos
   * armados y al original le falta la botella. Null = no le falta nada.
   */
  motivo_agotado: z.enum(['sin_esencia', 'sin_armados', 'sin_producto']).nullable().default(null),
  /** Frascos de este perfume que ya están armados, sumando todas sus tallas. */
  frascos_armados: z.number().default(0),
  /** Los 1.1: solo se venden si ya están armados, nunca contra pedido. */
  solo_armado: z.boolean().default(false),
  /**
   * ¿Está en la tienda? Distinto de `agotado`: un agotado SÍ se muestra (con su
   * marca y el "avísame cuando vuelva"); uno despublicado no aparece por ningún
   * lado. Solo el dashboard llega a ver los que están en false.
   */
  publicado: z.boolean().default(true),
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
