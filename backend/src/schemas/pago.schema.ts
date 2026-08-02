import { z } from 'zod/v4';

/**
 * Línea de la compra: qué insumo entró, cuánto y por cuánto.
 *
 * `unidad_compra` es solo para el registro: el proveedor factura ml y gramos
 * **1 a 1**, así que `g` entra como ml sin convertir por densidad (así se
 * cuadra contra su factura). No meter densidades aquí.
 */
export const compraItemSchema = z.object({
  insumo_id: z.number().int().positive('Elige el insumo'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  unidad_compra: z.enum(['ml', 'g', 'l', 'kg', 'unidad']).default('unidad'),
  subtotal: z.number().min(0, 'No puede ser negativo'),
});

export const createPagoSchema = z.object({
  dia: z.string().min(1, 'El día es obligatorio'),
  empresa_id: z.number().int().positive('La empresa es obligatoria'),
  valor_compra: z.number().positive('El valor debe ser mayor a 0'),
  coste_envio: z.number().min(0).optional(),
  detalles_adicionales: z.string().max(5000).nullish(),
  numero_factura: z.string().max(60).nullish(),
  /// URLs de los soportes ya subidos (se suben aparte, como las fotos).
  archivos: z.array(z.string().max(500)).max(10).optional(),
  /// Detalle opcional: un pago sin líneas sigue siendo válido (los históricos
  /// no lo tienen) pero solo los que traen líneas mueven el inventario.
  items: z.array(compraItemSchema).max(60).optional(),
});

export type CreatePagoInput = z.infer<typeof createPagoSchema>;
