import { z } from 'zod/v4';

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'El color debe ser hexadecimal (ej: #5b4a8a)');

const formaSchema = z.enum(['redondo', 'cuadrado']);

export const contactoConfigSchema = z.object({
  avatar_url: z.string().url('La URL del avatar no es válida').max(2000).optional().or(z.literal('')),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  fondo_tipo: z.enum(['color', 'imagen']),
  fondo_valor: z.string().max(500).optional().or(z.literal('')),
  boton_forma: formaSchema,
  boton_color_fondo: hexColor,
  boton_color_texto: hexColor,
  contenido_posicion: z.enum(['arriba', 'centro']),
  redes_posicion: z.enum(['centro', 'abajo']),
});

export const createContactoLinkSchema = z.object({
  tipo: z.enum(['boton', 'red']),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  url: z.string().url('La URL no es válida').max(2000),
  emoji: z.string().max(20).optional().or(z.literal('')),
  icono: z.string().max(30).optional().or(z.literal('')),
  forma: formaSchema.nullable().optional(),
  color_fondo: hexColor.nullable().optional(),
  color_texto: hexColor.nullable().optional(),
  activo: z.boolean().optional(),
});

export const reorderContactoLinksSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Se requiere al menos un id'),
});

/** Respaldo completo de la página Contáctame (config + links) en JSON. */
export const contactoImportSchema = z.object({
  config: z.object({
    avatar_url: z.string().max(2000).nullable().optional(),
    nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
    descripcion: z.string().max(500).nullable().optional(),
    fondo_tipo: z.enum(['color', 'imagen']),
    fondo_valor: z.string().max(500).nullable().optional(),
    boton_forma: formaSchema,
    boton_color_fondo: hexColor,
    boton_color_texto: hexColor,
    contenido_posicion: z.enum(['arriba', 'centro']),
    redes_posicion: z.enum(['centro', 'abajo']),
  }),
  links: z
    .array(
      z.object({
        tipo: z.enum(['boton', 'red']),
        nombre: z.string().min(1).max(100),
        url: z.string().url('Hay un link con URL inválida').max(2000),
        emoji: z.string().max(20).nullable().optional(),
        icono: z.string().max(30).nullable().optional(),
        forma: formaSchema.nullable().optional(),
        color_fondo: hexColor.nullable().optional(),
        color_texto: hexColor.nullable().optional(),
        activo: z.boolean().optional(),
      }),
    )
    .max(100, 'Máximo 100 links'),
});

export type ContactoImportInput = z.infer<typeof contactoImportSchema>;

export type ContactoConfigInput = z.infer<typeof contactoConfigSchema>;
export type ContactoLinkInput = z.infer<typeof createContactoLinkSchema>;
