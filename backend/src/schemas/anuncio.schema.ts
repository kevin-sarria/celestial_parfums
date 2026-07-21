import { z } from 'zod/v4';

export const createAnuncioSchema = z.object({
  titulo: z.string().min(1, 'El título es obligatorio').max(150),
  mensaje: z.string().max(2000).nullish(),
  imagen_url: z.string().url('La URL de la imagen no es válida').max(2000).nullish().or(z.literal('')),
  tipo: z.enum(['imagen', 'mensaje', 'descuento']),
  audiencia: z.enum(['todos', 'no_registrados', 'registrados']),
  una_vez: z.boolean().optional(),
  activo: z.boolean().optional(),
  orden: z.number().int().min(0).max(999).optional(),
  // Vigencia opcional (YYYY-MM-DD); null = sin límite
  inicio: z.string().nullish(),
  fin: z.string().nullish(),
  // Solo tipo descuento:
  descuento_pct: z.number().int().min(0).max(100).optional(),
  aplica_combos: z.boolean().optional(),
  categoria_ids: z.array(z.number().int().positive()).optional(),
  // Reglas para que el cupón aplique (0 = sin mínimo)
  min_unidades: z.number().int().min(0).max(999).optional(),
  min_monto: z.number().min(0).optional(),
  // Guardarraíles (0 = sin límite): tope del descuento en pesos y cupo de canjes
  max_descuento: z.number().min(0).optional(),
  max_canjes: z.number().int().min(0).max(9999).optional(),
});

export type CreateAnuncioInput = z.infer<typeof createAnuncioSchema>;

/** El admin solo puede reactivar o anular un código (el canje lo hace la venta). */
export const estadoCodigoSchema = z.object({
  estado: z.enum(['activo', 'anulado']),
});
