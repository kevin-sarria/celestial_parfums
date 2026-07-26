import rateLimit from 'express-rate-limit';

/**
 * Límite estricto para endpoints de SUBIDA de fotos (reseñas, premios): cada
 * subida procesa la imagen con sharp (CPU), así que un cliente logueado abusivo
 * no debe poder disparar decenas por minuto. Un usuario real sube 1-3 y ya.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas subidas seguidas, intenta de nuevo en un rato' },
});
