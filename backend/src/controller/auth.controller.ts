import { Request, Response } from 'express';
import {
  loginService,
  googleAuthService,
  refreshService,
  registerAdminService,
  registerClientService,
  verifyEmailService,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from '../services/auth.service';

const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' as const : 'lax' as const,
  path: '/',
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_MAX_AGE });
  res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TOKEN_MAX_AGE, path: '/api/auth' });
}

export const login = async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken, user } = await loginService(req.body);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(200).json({ message: 'Login exitoso', data: { token: accessToken, user } });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken, user } = await googleAuthService(req.body?.credential);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(200).json({ message: 'Login con Google exitoso', data: { token: accessToken, user } });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      res.status(401).json({ error: 'No hay refresh token' });
      return;
    }
    const { accessToken, refreshToken } = refreshService(token);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ message: 'Token renovado' });
  } catch (err: any) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.status(401).json({ error: err.message });
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie('access_token', COOKIE_OPTS);
  res.clearCookie('refresh_token', { ...COOKIE_OPTS, path: '/api/auth' });
  res.json({ message: 'Sesión cerrada' });
};

export const me = async (req: Request, res: Response) => {
  res.json({ data: req.jwtUser });
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
