import { z } from 'zod/v4';

export const createCreditoSchema = z.object({
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  user_id: z.number().int().positive('La persona es obligatoria'),
  articulos: z.string().min(1, 'Los artículos son obligatorios'),
  deuda_inicial: z.number().positive('La deuda inicial debe ser mayor a 0'),
});

export const addAbonoSchema = z.object({
  monto: z.number().positive('El monto debe ser mayor a 0'),
});

export type CreateCreditoInput = z.infer<typeof createCreditoSchema>;
