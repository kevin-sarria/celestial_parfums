import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verifica server-side el token de reCAPTCHA v3 enviado por el frontend
 * (campo `captcha` del body) contra la API de Google.
 *
 * Debe ir ANTES de validate(): el schema zod reemplaza req.body y
 * eliminaría el campo captcha.
 *
 * Si RECAPTCHA_SECRET_KEY no está configurada la verificación se omite
 * (entornos de desarrollo sin claves) dejando constancia en el log.
 */
export const verifyCaptcha = (action: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      logger.warn('RECAPTCHA_SECRET_KEY no configurada: verificación de captcha omitida');
      next();
      return;
    }

    const token = req.body?.captcha;
    if (typeof token !== 'string' || !token || token.length > 3000) {
      res.status(400).json({ error: 'Verificación de seguridad requerida' });
      return;
    }

    try {
      const params = new URLSearchParams({ secret, response: token });
      const remoteIp = req.ip;
      if (remoteIp) params.set('remoteip', remoteIp);

      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = (await response.json()) as SiteVerifyResponse;

      const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
      // score/action solo existen en tokens v3 reales; las claves de prueba de
      // Google (solo dev) no los devuelven, por eso se validan si están presentes.
      const valido =
        data.success === true &&
        (data.score === undefined || data.score >= minScore) &&
        (data.action === undefined || data.action === action);

      if (!valido) {
        logger.warn('Captcha rechazado', {
          action,
          score: data.score,
          tokenAction: data.action,
          errores: data['error-codes'],
        });
        res.status(400).json({ error: 'Verificación de seguridad fallida, intenta de nuevo' });
        return;
      }

      next();
    } catch (err: any) {
      logger.error('Error verificando captcha', { message: err?.message });
      res.status(502).json({ error: 'No se pudo validar la verificación de seguridad' });
    }
  };
