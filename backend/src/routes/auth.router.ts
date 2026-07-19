import { Router } from 'express';
import { login, googleAuth, logout, refresh, me, registerAdmin, registerClient, verifyEmail } from '../controller/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { verifyCaptcha } from '../middleware/captcha.middleware';
import { loginSchema, registerSchema } from '../schemas/auth.schema';

export const authRouter = Router();

authRouter.post('/login', verifyCaptcha('LOGIN'), validate(loginSchema), login);
authRouter.post('/google', googleAuth);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
authRouter.post('/register', verifyCaptcha('REGISTER'), validate(registerSchema), registerClient);
authRouter.post('/register-admin', validate(registerSchema), registerAdmin);
authRouter.get('/verify/:token', verifyEmail);
