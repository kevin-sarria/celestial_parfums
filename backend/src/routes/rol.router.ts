import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import * as repo from '../repositories/rol.repository';

/** Los roles del personal y sus permisos. Solo el dueño (ver `rol.repository.ts`). */
export const rolRouter = Router();
rolRouter.use(requireAdmin);

rolRouter.get('/', h(async (_req, res) => { res.json({ data: await repo.listarRoles() }); }));
rolRouter.get('/permisos', h(async (_req, res) => { res.json({ data: repo.catalogoDePermisos() }); }));
rolRouter.post('/', h(async (req, res) => {
  res.status(201).json({ message: 'Rol creado', data: await repo.crearRol(req.body?.nombre, req.body?.permisos) });
}));
rolRouter.patch('/:id', h(async (req, res) => {
  res.json({ message: 'Rol guardado', data: await repo.editarRol(Number(req.params.id), req.body?.nombre, req.body?.permisos) });
}));
rolRouter.delete('/:id', h(async (req, res) => {
  await repo.borrarRol(Number(req.params.id));
  res.json({ message: 'Rol borrado' });
}));
