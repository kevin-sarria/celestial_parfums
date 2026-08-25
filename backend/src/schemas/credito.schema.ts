import { z } from 'zod/v4';
import { lineaVentaSchema } from './venta.schema';

export const createCreditoSchema = z.object({
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  user_id: z.number().int().positive('La persona es obligatoria'),
  articulos: z.string().min(1, 'Los artículos son obligatorios'),
  // Con cupón, es el valor ANTES del descuento; el backend calcula la deuda real
  deuda_inicial: z.number().positive('La deuda inicial debe ser mayor a 0'),
  // Acuerdo de pago (AAAA-MM-DD); si se omite, 1 mes desde la fecha
  fecha_limite: z.string().nullish(),
  // Código a canjear en el crédito (se consume al crear)
  codigo_descuento: z.string().max(20).nullish(),
  // Perfumes elegidos (ids repetidos por cantidad); vacío = inferir del texto
  perfume_ids: z.array(z.number().int().positive()).optional(),
  /**
   * Forma nueva: una línea por producto+talla, la MISMA de las ventas. Sin
   * ellas el crédito no sabía qué talla se llevó el cliente, y por eso no podía
   * descontar inventario ni admitir un 1.1 o un perfumero.
   */
  lineas: z.array(lineaVentaSchema).optional(),
  // Resumen de presentaciones vendidas
  presentacion: z.string().max(100).nullish(),
});

export const addAbonoSchema = z.object({
  monto: z.number().positive('El monto debe ser mayor a 0'),
});

export type CreateCreditoInput = z.infer<typeof createCreditoSchema>;
