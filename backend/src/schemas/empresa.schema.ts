import { z } from 'zod/v4';

export const createEmpresaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  nit: z.string().max(50).optional(),
  telefono: z.string().max(20).optional(),
  correo: z.email('Correo inválido').optional().or(z.literal('')),
  direccion: z.string().max(255).optional(),
});

export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
