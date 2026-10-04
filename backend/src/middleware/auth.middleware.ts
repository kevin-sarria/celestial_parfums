import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { esPersonal, puede, rolVigente } from '../permisos/permisos';

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

/**
 * Pone en `req.jwtUser` el rol que la persona tiene HOY (ver `rolVigente`):
 * lo que venga después —el handler, `ocultarCostos`, el historial— decide con
 * él y no con el del token. Sin rol (cuenta desactivada): -1, que no puede nada.
 */
const conRolVigente = async (req: Request) => {
  if (!req.jwtUser || req.jwtUser.rol_id === 1) return;
  req.jwtUser = { ...req.jwtUser, rol_id: (await rolVigente(req.jwtUser.id)) ?? -1 };
};

/**
 * Pide UNO de estos permisos (ver `permisos/catalogo.ts`). El dueño (rol 1)
 * pasa siempre. Es el reemplazo de `requireAdmin` en lo que el personal puede
 * tocar (2026-10-04); lo que sigue con `requireAdmin` es solo del dueño.
 */
export const requirePermiso = (...permisos: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      conRolVigente(req)
        .then(() => puede(req.jwtUser?.rol_id, ...permisos))
        .then((ok) => {
          if (ok) { next(); return; }
          res.status(403).json({ error: 'No tienes permiso para esto. Pídeselo al dueño.' });
        })
        .catch(next);
    });
  };

/** Cualquiera que trabaje en el panel: el dueño o un rol de personal. */
export const requirePersonal = (req: Request, res: Response, next: NextFunction): void => {
  requireAuth(req, res, () => {
    conRolVigente(req)
      .then(() => esPersonal(req.jwtUser?.rol_id))
      .then((ok) => {
        if (ok) { next(); return; }
        res.status(403).json({ error: 'Acceso denegado' });
      })
      .catch(next);
  });
};

/**
 * El rol de quien hace la petición, haya pasado o no por `requireAuth`. Para
 * las rutas públicas que cambian según quién pregunta (el catálogo con lo
 * oculto, esconder costos). Sin sesión válida: undefined.
 */
export const rolDeRequest = (req: Request): number | undefined => {
  if (req.jwtUser) return req.jwtUser.rol_id;
  const token = extractToken(req);
  if (!token) return undefined;
  try { return (jwt.verify(token, JWT_SECRET) as JWTPayload).rol_id; } catch { return undefined; }
};
