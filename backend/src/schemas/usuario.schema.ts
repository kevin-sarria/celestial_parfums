import { z } from 'zod/v4';

/** Edición de personas (cuentas y fichas) desde el panel admin. */
export const updateUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
  email: z.email('Correo inválido'),
  activo: z.boolean().optional(),
  // Nueva contraseña: solo si el admin quiere restablecerla ('' = no cambiar)
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(255).optional().or(z.literal('')),
  telefono: z.string().max(20).nullable().optional(),
  direccion: z.string().max(255).nullable().optional(),
  // Cupo de crédito base (COP); el factor de comportamiento lo ajusta solo.
  cupo_base: z.number().min(0).max(99_000_000).optional(),
});

/** Ficha creada por el admin (persona sin cuenta web todavía). */
export const createFichaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
  // Correo opcional: si se conoce, al registrarse con él la persona hereda su historial.
  email: z.email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().max(20).optional(),
  direccion: z.string().max(255).optional(),
  cupo_base: z.number().min(0).max(99_000_000).optional(),
});

export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;
export type CreateFichaInput = z.infer<typeof createFichaSchema>;
