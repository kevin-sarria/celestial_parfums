import { Router } from 'express';
import { login, registerAdmin, registerClient, verifyEmail } from '../controller/auth.controller';

export const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/register', registerClient);
authRouter.post('/register-admin', registerAdmin);
authRouter.get('/verify/:token', verifyEmail);
