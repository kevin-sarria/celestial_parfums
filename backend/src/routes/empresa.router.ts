import { Router } from 'express';
import { getEmpresas, addEmpresa, editEmpresa, removeEmpresa } from '../controller/empresa.controller';
import { requireAdmin } from '../middleware/auth.middleware';

export const empresaRouter = Router();

empresaRouter.use(requireAdmin);

empresaRouter.get('/', getEmpresas);
empresaRouter.post('/', addEmpresa);
empresaRouter.patch('/:id', editEmpresa);
empresaRouter.delete('/:id', removeEmpresa);
