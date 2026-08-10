import { z } from 'zod/v4';

export const createPerfumeSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  // Campos opcionales: aceptan texto, null o ausente (el formulario envía null al vaciarlos)
  descripcion: z.string().max(5000).nullish(),
  precio: z.number().positive('El precio debe ser mayor a 0'),
  duracion: z.string().max(50).nullish(),
  proyeccion: z.string().max(50).nullish(),
  imagen_url: z.string().url().nullish().or(z.literal('')),
  genero: z.enum(['dama', 'caballero', 'unisex']).nullable().optional(),
  categoria_id: z.number().int().positive().nullable().optional(),
  descuento: z.number().int().min(0).max(100).optional(),
  agotado: z.boolean().optional(),
  publicado: z.boolean().optional(),
  // Contratipo de esencia premium: distintivo propio y fuera de los combos
  esencia_premium: z.boolean().optional(),
  /// Esencia concreta con la que se hace (Eternity, Khamrah…). Null = sin asignar.
  insumo_esencia_id: z.number().int().positive().nullish(),
  /// Cómo se abastece: fabricado (receta), comprado (reventa) o fraccionado (decants).
  tipo_producto: z.enum(['fabricado','comprado','fraccionado']).optional(),
  /// El insumo que ES el producto (comprado) o del que sale (fraccionado).
  insumo_producto_id: z.number().int().positive().nullish(),
  /// Solo fraccionado: ml que de verdad se aprovechan de la botella.
  ml_utiles: z.number().int().positive().nullish(),
  /**
   * Aromas y ocasiones dejaron de ser obligatorios: el catálogo ya no es solo
   * perfumes (una gorra no tiene notas olfativas ni ocasión de uso), y al crear
   * un producto al vuelo desde una venta se completan después con calma.
   */
  tipos_aroma: z.array(z.number().int().positive()).default([]),
  ocasiones: z.array(z.number().int().positive()).default([]),
  presentaciones: z.array(z.number().int().positive()).default([]),
  // Excepciones a la lista de precios: solo las presentaciones que NO usan el
  // precio estándar de su categoría (los de esencia premium suelen llevar una por talla)
  /// Frasco y accesorios propios por talla: [{presentacion_id, envase_insumo_id, accesorios}]
  envases_talla: z.array(z.object({
    presentacion_id: z.number().int().positive(),
    envase_insumo_id: z.number().int().positive().nullish(),
    accesorios: z.array(z.number().int().positive()).default([]),
  })).optional(),
  precios_propios: z
    .array(
      z.object({
        presentacion_id: z.number().int().positive(),
        precio: z.number().positive('El precio propio debe ser mayor a 0'),
      }),
    )
    .optional(),
});

export const patchDescuentoSchema = z.object({
  descuento: z.number().int().min(0).max(100),
});

export const patchDescuentoCategoriaSchema = z.object({
  categoria_id: z.number().int().positive(),
  descuento: z.number().int().min(0).max(100),
});

/**
 * Asignar la misma esencia a varios perfumes. `insumo_esencia_id` en null
 * la QUITA, que es la forma de deshacer una asignación equivocada en bloque.
 */
export const asignarEsenciaMasivaSchema = z.object({
  perfume_ids: z.array(z.number().int().positive()).min(1, 'Marca al menos un perfume'),
  insumo_esencia_id: z.number().int().positive().nullable(),
});

/** Lista de enlaces perfume -> esencia que el dueño confirmó en la vista previa. */
export const enlacesEsenciaSchema = z.object({
  enlaces: z.array(z.object({
    perfume_id: z.number().int().positive(),
    insumo_esencia_id: z.number().int().positive(),
  })).min(1, 'No hay enlaces que aplicar').max(500),
});

/**
 * Puesta al día de esencias: por cada una, o se enlaza con un perfume que ya
 * existe o se crea un borrador con ese nombre. Nunca las dos cosas.
 */
export const emparejarEsenciasSchema = z.object({
  acciones: z.array(z.object({
    insumo_id: z.number().int().positive(),
    perfume_id: z.number().int().positive().optional(),
    crear: z.string().trim().min(1).max(150).optional(),
  }).refine((a) => (a.perfume_id == null) !== (a.crear == null), {
    message: 'Cada esencia se enlaza a un perfume o crea uno nuevo, no ambas',
  })).min(1, 'No elegiste ninguna esencia').max(300),
});

export const patchAgotadoSchema = z.object({
  agotado: z.boolean(),
});

export const patchPublicadoSchema = z.object({
  publicado: z.boolean(),
});

/** Precio estándar de una categoría en una presentación (null = quitarlo de la lista). */
export const precioListaSchema = z.object({
  categoria_id: z.number().int().positive(),
  presentacion_id: z.number().int().positive(),
  precio: z.number().positive('El precio debe ser mayor a 0').nullable(),
});

export const nombreSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
});

export type CreatePerfumeInput = z.infer<typeof createPerfumeSchema>;
