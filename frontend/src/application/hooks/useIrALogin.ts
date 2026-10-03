import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Manda a iniciar sesión RECORDANDO de dónde venía.
 *
 * Antes todo login terminaba en la portada: quien tocaba "Inicia sesión y te
 * avisamos" en la ficha de un perfume entraba… y perdía el perfume (revisión
 * del 2026-10-02). La página de origen viaja en el `state` de la navegación,
 * no en la URL: así no se puede fabricar un enlace de login que mande a otro
 * sitio.
 */
export function useIrALogin() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return useCallback(
    (reemplazar = false) => navigate('/login', { replace: reemplazar, state: { desde: pathname + search } }),
    [navigate, pathname, search],
  );
}

/**
 * A dónde ir al entrar: el dueño a su panel; el cliente, a donde estaba, o a
 * la portada (que ya lo saluda con su franja). Solo rutas internas.
 */
export const destinoTrasLogin = (state: unknown, rolId?: number): string => {
  if (rolId === 1) return '/dashboard';
  const desde = (state as { desde?: unknown } | null)?.desde;
  return typeof desde === 'string' && desde.startsWith('/') && !desde.startsWith('//')
    && !/^\/(login|register|verify)\b/.test(desde) ? desde : '/';
};
