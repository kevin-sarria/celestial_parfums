import { z } from 'zod/v4';

export const createClienteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
  correo: z.email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().max(20).optional(),
  direccion: z.string().max(255).optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
