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
  // Contratipo de esencia premium: distintivo propio y fuera de los combos
  esencia_premium: z.boolean().optional(),
  tipos_aroma: z.array(z.number().int().positive()).min(1, 'Debe tener al menos un aroma'),
  ocasiones: z.array(z.number().int().positive()).min(1, 'Debe tener al menos una ocasión'),
  presentaciones: z.array(z.number().int().positive()).default([]),
  // Excepciones a la lista de precios: solo las presentaciones que NO usan el
  // precio estándar de su categoría (los de esencia premium suelen llevar una por talla)
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

export const patchAgotadoSchema = z.object({
  agotado: z.boolean(),
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
