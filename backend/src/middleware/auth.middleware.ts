import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mismo criterio que auth.service: en producción JWT_SECRET es obligatoria
// (el arranque ya falla allí si falta); el fallback solo aplica en desarrollo
// y debe coincidir con el de requireSecret() para que los tokens validen.
const JWT_SECRET = process.env.JWT_SECRET?.trim() || 'dev_only_jwt_secret';

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

function extractToken(req: Request): string | null {
  const cookie = req.cookies?.access_token;
  if (cookie) return cookie;

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);

  return null;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  try {
    req.jwtUser = jwt.verify(token, JWT_SECRET) as JWTPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

/**
 * ¿La petición viene de un ADMIN autenticado? No corta la cadena: sirve para
 * decidir cosas como eximirlo de los límites anti-abuso (esos existen para
 * frenar visitantes anónimos, no al dueño trabajando en su tienda).
 * Requiere que cookieParser haya corrido antes.
 */
export const esAdminRequest = (req: Request): boolean => {
  const token = extractToken(req);
  if (!token) return false;
  try {
    return (jwt.verify(token, JWT_SECRET) as JWTPayload).rol_id === 1;
  } catch {
    return false;
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
