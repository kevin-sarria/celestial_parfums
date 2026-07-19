import { z } from 'zod';

export const contactoFormaSchema = z.enum(['redondo', 'cuadrado']);

export const contactoConfigSchema = z.object({
  avatar_url: z.string().nullable(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  fondo_tipo: z.enum(['color', 'imagen']),
  fondo_valor: z.string().nullable(),
  boton_forma: contactoFormaSchema,
  boton_color_fondo: z.string(),
  boton_color_texto: z.string(),
  contenido_posicion: z.enum(['arriba', 'centro']),
  redes_posicion: z.enum(['centro', 'abajo']),
});

export const contactoLinkSchema = z.object({
  id: z.number(),
  tipo: z.enum(['boton', 'red']),
  nombre: z.string(),
  url: z.string(),
  emoji: z.string().nullable(),
  icono: z.string().nullable(),
  forma: contactoFormaSchema.nullable(),
  color_fondo: z.string().nullable(),
  color_texto: z.string().nullable(),
  orden: z.number(),
  activo: z.boolean(),
});

export type ContactoForma = z.infer<typeof contactoFormaSchema>;
export type ContactoConfig = z.infer<typeof contactoConfigSchema>;
export type ContactoLink = z.infer<typeof contactoLinkSchema>;
