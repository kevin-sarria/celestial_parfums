import { prisma } from '../config/prisma';
import type { RegisterDTO } from '../types/auth.type';

export const findUserByEmail = (email: string) =>
  prisma.user.findFirst({ where: { email, activo: true } });

export const findUserByEmailAny = (email: string) =>
  prisma.user.findFirst({ where: { email } });

export const findUserByToken = (token: string) =>
  prisma.user.findFirst({ where: { verification_token: token } });

export const createUser = (
  dto: RegisterDTO & { hashedPassword: string; verification_token: string; token_expiry: Date }
) =>
  prisma.user.create({
    data: {
      nombre:             dto.nombre,
      apellido:           dto.apellido,
      email:              dto.email,
      password:           dto.hashedPassword,
      rol_id:             dto.rol_id,
      activo:             false,
      verification_token: dto.verification_token,
      token_expiry:       dto.token_expiry,
    },
  });

export const activateUser = (id: number) =>
  prisma.user.update({
    where: { id },
    data: { activo: true, verification_token: null, token_expiry: null },
  });

/**
 * Una ficha creada por el admin (sin_cuenta) se "reclama" cuando la persona se
 * registra con ese correo: obtiene acceso web y conserva TODO su historial de
 * ventas y créditos (misma fila de users).
 */
export const claimFichaUser = (
  id: number,
  data: {
    hashedPassword: string;
    activo: boolean;
    verification_token?: string | null;
    token_expiry?: Date | null;
  },
) =>
  prisma.user.update({
    where: { id },
    data: {
      password: data.hashedPassword,
      activo: data.activo,
      sin_cuenta: false,
      verification_token: data.verification_token ?? null,
      token_expiry: data.token_expiry ?? null,
    },
  });

/** Crea una cuenta ya activa a partir de un inicio de sesión con Google. */
export const createGoogleUser = (data: {
  nombre: string;
  apellido: string;
  email: string;
  hashedPassword: string;
  rol_id: number;
}) =>
  prisma.user.create({
    data: {
      nombre:   data.nombre,
      apellido: data.apellido,
      email:    data.email,
      password: data.hashedPassword,
      rol_id:   data.rol_id,
      activo:   true,
    },
  });
