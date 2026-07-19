import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as repo from '../repositories/usuario.repository';
import { CreateFichaInput, UpdateUsuarioInput } from '../schemas/usuario.schema';
import { conflict, notFound } from '../utils/httpError';

export const getAllUsers = () => repo.getAllUsers();

/** Email sintético único para fichas sin correo conocido. */
const syntheticEmail = () => `ficha-${crypto.randomBytes(6).toString('hex')}@sin-cuenta.local`;

export const createFicha = async (dto: CreateFichaInput) => {
  const email = dto.email?.trim() || syntheticEmail();
  if (await repo.findUserByEmail(email)) {
    throw conflict('Ya existe una persona con ese correo');
  }
  return repo.createFicha({
    nombre: dto.nombre,
    apellido: dto.apellido,
    email,
    telefono: dto.telefono || null,
    direccion: dto.direccion || null,
    cupo_base: dto.cupo_base,
  });
};

export const updateUser = async (id: number, adminId: number, dto: UpdateUsuarioInput) => {
  const user = await repo.findUserById(id);
  if (!user) throw notFound('Usuario no encontrado');

  // El admin no puede desactivarse a sí mismo (se dejaría por fuera del panel)
  if (id === adminId && dto.activo === false) {
    throw new Error('No puedes desactivar tu propia cuenta');
  }

  const emailEnUso = await repo.findUserByEmailExcept(dto.email, id);
  if (emailEnUso) throw conflict('Ya existe otra persona con ese correo');

  const hashedPassword = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

  return repo.updateUser(id, {
    nombre: dto.nombre,
    apellido: dto.apellido,
    email: dto.email,
    activo: dto.activo,
    hashedPassword,
    telefono: dto.telefono !== undefined ? dto.telefono || null : undefined,
    direccion: dto.direccion !== undefined ? dto.direccion || null : undefined,
    cupo_base: dto.cupo_base,
  });
};

export const deleteUser = async (id: number, adminId: number) => {
  if (id === adminId) throw new Error('No puedes eliminar tu propia cuenta');
  const user = await repo.findUserById(id);
  if (!user) throw notFound('Usuario no encontrado');
  const creditos = await repo.countCreditosByUser(id);
  if (creditos > 0) {
    throw conflict('Esta persona tiene créditos registrados; elimínalos primero para conservar la contabilidad');
  }
  await repo.deleteUser(id);
};
