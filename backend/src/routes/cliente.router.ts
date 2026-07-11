import { Router } from 'express';
import { getClientes, addCliente, editCliente, removeCliente } from '../controller/cliente.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createClienteSchema } from '../schemas/cliente.schema';

export const clienteRouter = Router();

clienteRouter.use(requireAdmin);

clienteRouter.get('/', getClientes);
clienteRouter.post('/', validate(createClienteSchema), addCliente);
clienteRouter.patch('/:id', validate(createClienteSchema), editCliente);
clienteRouter.delete('/:id', removeCliente);
