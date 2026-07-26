import { z } from 'zod/v4';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal (ej: #141119)');

export const recompensaConfigSchema = z.object({
  activo: z.boolean(),
  sellos_objetivo: z.number().int().min(1, 'Debe pedir al menos 1 sello').max(50),
  premio: z.string().min(1, 'Describe el premio').max(200),
  min_compra: z.number().min(0),
  color_fondo: hex,
  color_lineas: hex,
  color_texto: hex,
});

/** Regla especial de un cliente: cada campo null = usa la config global. */
export const recompensaOverrideSchema = z.object({
  objetivo_override: z.number().int().min(1).max(50).nullable(),
  premio_override: z.string().max(200).nullable(),
  min_compra_override: z.number().min(0).nullable(),
});

export type RecompensaConfigInput = z.infer<typeof recompensaConfigSchema>;
export type RecompensaOverrideInput = z.infer<typeof recompensaOverrideSchema>;
