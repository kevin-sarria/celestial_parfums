import { Router } from 'express';
import { requireAdmin, requirePermiso } from '../middleware/auth.middleware';
import { puede } from '../permisos/permisos';
import { asignarRol } from '../repositories/rol.repository';
import { h } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';
import { createFichaSchema, updateUsuarioSchema } from '../schemas/usuario.schema';
import * as usuarioService from '../services/usuario.service';
import { getPerfilCrediticio } from '../services/creditoPerfil.service';

/** Gestión de personas: cuentas web y fichas sin cuenta (solo admin). */
export const usuarioRouter = Router();

/** Quien registra ventas o créditos tiene que poder elegir a la persona. */
const PARA_ELEGIR_CLIENTE = ['clientes.ver', 'ventas.registrar', 'creditos.registrar'];

/**
 * La lista de personas. Sin `clientes.ver` (2026-10-04) solo salen los
 * nombres: para registrar una venta basta, y los datos de contacto de todos
 * los clientes en bloque son lo que la Ley 1581 obliga a custodiar.
 */
usuarioRouter.get('/', requirePermiso(...PARA_ELEGIR_CLIENTE), h(async (req, res) => {
  const todos = await usuarioService.getAllUsers();
  if (await puede(req.jwtUser!.rol_id, 'clientes.ver')) { res.json({ data: todos }); return; }
  res.json({ data: todos.map((u) => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, rol_id: u.rol_id, sin_cuenta: u.sin_cuenta })) });
}));

/** Perfil crediticio interno (cupo, factor, eventos, veto). */
usuarioRouter.get('/:id/perfil-credito', requirePermiso('creditos.ver', 'creditos.registrar'), h(async (req, res) => {
  res.json({ data: await getPerfilCrediticio(Number(req.params.id)) });
}));

/** Crear una ficha (persona sin cuenta web) para ligar ventas/créditos. */
usuarioRouter.post('/', requirePermiso(...PARA_ELEGIR_CLIENTE), validate(createFichaSchema), h(async (req, res) => {
  const data = await usuarioService.createFicha(req.body);
  res.status(201).json({ message: 'Persona registrada', data });
}));

/** El rol de una persona: cliente o uno del personal. Solo el dueño. */
usuarioRouter.patch('/:id/rol', requireAdmin, h(async (req, res) => {
  res.json({ message: 'Rol actualizado', data: await asignarRol(Number(req.params.id), req.body?.rol_id, req.jwtUser!.id) });
}));

usuarioRouter.patch('/:id', requireAdmin, validate(updateUsuarioSchema), h(async (req, res) => {
  const data = await usuarioService.updateUser(Number(req.params.id), req.jwtUser!.id, req.body);
  res.json({ message: 'Usuario actualizado', data });
}));

usuarioRouter.delete('/:id', requireAdmin, h(async (req, res) => {
  await usuarioService.deleteUser(Number(req.params.id), req.jwtUser!.id);
  res.json({ message: 'Usuario eliminado' });
}));
