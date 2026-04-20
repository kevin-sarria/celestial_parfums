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
