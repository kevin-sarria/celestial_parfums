import { Router } from 'express';
import { getClientes, addCliente, editCliente, removeCliente } from '../controller/cliente.controller';
import { requireAdmin } from '../middleware/auth.middleware';

export const clienteRouter = Router();

clienteRouter.use(requireAdmin);

clienteRouter.get('/', getClientes);
clienteRouter.post('/', addCliente);
clienteRouter.patch('/:id', editCliente);
clienteRouter.delete('/:id', removeCliente);
