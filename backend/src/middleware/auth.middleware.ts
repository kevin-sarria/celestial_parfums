import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'celestial_secret_key';

export interface JWTPayload {
  id: number;
  email: string;
  rol_id: number;
}

declare global {
  namespace Express {
    interface Request {
      jwtUser?: JWTPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  try {
    req.jwtUser = jwt.verify(auth.slice(7), JWT_SECRET) as JWTPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  requireAuth(req, res, () => {
    if (req.jwtUser?.rol_id !== 1) {
      res.status(403).json({ error: 'Acceso denegado: se requiere rol de administrador' });
      return;
    }
    next();
  });
};
