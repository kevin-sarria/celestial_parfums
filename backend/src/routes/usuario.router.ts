import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';
import { createFichaSchema, updateUsuarioSchema } from '../schemas/usuario.schema';
import * as usuarioService from '../services/usuario.service';
import { getPerfilCrediticio } from '../services/creditoPerfil.service';

/** Gestión de personas: cuentas web y fichas sin cuenta (solo admin). */
export const usuarioRouter = Router();

usuarioRouter.use(requireAdmin);

usuarioRouter.get('/', h(async (_req, res) => {
  res.json({ data: await usuarioService.getAllUsers() });
}));

/** Perfil crediticio interno (cupo, factor, eventos, veto). */
usuarioRouter.get('/:id/perfil-credito', h(async (req, res) => {
  res.json({ data: await getPerfilCrediticio(Number(req.params.id)) });
}));

/** Crear una ficha (persona sin cuenta web) para ligar ventas/créditos. */
usuarioRouter.post('/', validate(createFichaSchema), h(async (req, res) => {
  const data = await usuarioService.createFicha(req.body);
  res.status(201).json({ message: 'Persona registrada', data });
}));

usuarioRouter.patch('/:id', validate(updateUsuarioSchema), h(async (req, res) => {
  const data = await usuarioService.updateUser(Number(req.params.id), req.jwtUser!.id, req.body);
  res.json({ message: 'Usuario actualizado', data });
}));

usuarioRouter.delete('/:id', h(async (req, res) => {
  await usuarioService.deleteUser(Number(req.params.id), req.jwtUser!.id);
  res.json({ message: 'Usuario eliminado' });
}));
