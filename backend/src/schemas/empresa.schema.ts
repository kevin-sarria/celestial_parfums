import { z } from 'zod/v4';

export const createEmpresaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  nit: z.string().max(50).nullish(),
  telefono: z.string().max(20).nullish(),
  correo: z.email('Correo inválido').nullish().or(z.literal('')),
  direccion: z.string().max(255).nullish(),
});

export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
