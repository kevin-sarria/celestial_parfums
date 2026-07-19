import { Router } from 'express';
import { getEmpresas, addEmpresa, editEmpresa, removeEmpresa } from '../controller/empresa.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createEmpresaSchema } from '../schemas/empresa.schema';

export const empresaRouter = Router();

empresaRouter.use(requireAdmin);

empresaRouter.get('/', getEmpresas);
empresaRouter.post('/', validate(createEmpresaSchema), addEmpresa);
empresaRouter.patch('/:id', validate(createEmpresaSchema), editEmpresa);
empresaRouter.delete('/:id', removeEmpresa);
