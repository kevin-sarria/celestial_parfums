import { z } from 'zod/v4';

export const createEmpresaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  nit: z.string().max(50).nullish(),
  telefono: z.string().max(20).nullish(),
  correo: z.email('Correo inválido').nullish().or(z.literal('')),
  direccion: z.string().max(255).nullish(),
  /// Cómo factura el IVA este proveedor. Se configura UNA vez y todas sus
  /// compras la heredan: es lo que evita contarle el impuesto dos veces al
  /// que ya lo entrega incluido.
  iva_modo: z.enum(['incluido', 'agregado', 'sin_iva']).optional(),
});

export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
