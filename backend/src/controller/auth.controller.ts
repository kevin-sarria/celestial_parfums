import { Request, Response } from 'express';
import {
  loginService,
  registerAdminService,
  registerClientService,
  verifyEmailService,
} from '../services/auth.service';

export const login = async (req: Request, res: Response) => {
  try {
    const data = await loginService(req.body);
    res.status(200).json({ message: 'Login exitoso', data });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
};

export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const data = await registerAdminService(req.body);
    res.status(201).json({
      message: 'Registro exitoso. Revisa tu correo para activar tu cuenta.',
      data,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const registerClient = async (req: Request, res: Response) => {
  try {
    const data = await registerClientService(req.body);
    res.status(201).json({
      message: 'Registro exitoso. Revisa tu correo para activar tu cuenta.',
      data,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const data = await verifyEmailService(req.params.token as string);
    res.status(200).json({ message: 'Cuenta activada exitosamente', data });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};
