import type { NextFunction, Request, Response } from 'express';
import { puedeYa } from '../permisos/permisos';
import { rolDeRequest } from './auth.middleware';

/**
 * COSTOS Y GANANCIAS, SOLO PARA QUIEN PUEDE VERLOS (2026-10-04).
 *
 * Envuelve `res.json` de TODA la API: si quien pregunta no es el dueño ni
 * tiene el permiso `costos.ver`, se quitan de la respuesta las llaves que son
 * costo, ganancia o margen, a cualquier profundidad. Una sola regla en un solo
 * sitio: un endpoint nuevo que devuelva un costo queda tapado sin acordarse.
 *
 * Tapó, de paso, una fuga que ya existía: la tienda pública mandaba el costo
 * por ml de la esencia de cada perfume (`insumo_esencia_precio`) a cualquier
 * visitante. No se veía en pantalla, pero estaba en la respuesta.
 */
const ES_COSTO = /costo|ganancia|margen|utilidad|invertid|esencia_precio/i;

export const quitarCostos = (valor: unknown): unknown => {
  if (Array.isArray(valor)) return valor.map(quitarCostos);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>)
      .filter(([k]) => !ES_COSTO.test(k))
      .map(([k, v]) => [k, quitarCostos(v)]));
  }
  return valor;
};

export const ocultarCostos = (req: Request, res: Response, next: NextFunction) => {
  const responder = res.json.bind(res);
  res.json = (cuerpo: unknown) => responder(
    puedeYa(rolDeRequest(req), 'costos.ver') ? cuerpo : quitarCostos(cuerpo),
  );
  next();
};
