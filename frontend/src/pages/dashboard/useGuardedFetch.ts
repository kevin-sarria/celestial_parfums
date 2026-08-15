import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch, refreshAccessToken } from '../../infrastructure/api/client';
import { useAuthContext } from '../../application/context/useAuthContext';
import type { GuardedFetch } from './types';

/**
 * `fetch` con sesión: si el servidor dice 401 renueva el token y reintenta, y
 * si dice 403 saca al usuario.
 *
 * **Devuelve SIEMPRE la misma función** (deps vacías, lo de fuera vive en refs)
 * y eso no es una optimización cosmética: media docena de pantallas la usan como
 * dependencia de su efecto de carga. `useNavigate` de React Router 7 cambia de
 * identidad en CADA cambio de ruta, así que con `navigate` en las dependencias
 * el dashboard volvía a pedir clasificaciones, perfumes y combos **cada vez que
 * el dueño cambiaba de apartado**, aunque fuera a una pantalla que no los usa.
 * Medido el 2026-08-14: 11 peticiones por cambio de apartado; una era necesaria.
 */
export function useGuardedFetch(): GuardedFetch {
  const { logout } = useAuthContext();
  const navigate = useNavigate();

  // Las refs se actualizan en cada render; la función de abajo no.
  const logoutRef = useRef(logout);
  const navigateRef = useRef(navigate);
  useEffect(() => { logoutRef.current = logout; navigateRef.current = navigate; });

  return useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let res = await authFetch(input, init);
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        res = await authFetch(input, init);
      } else {
        logoutRef.current();
        navigateRef.current('/login');
      }
    }
    if (res.status === 403) {
      logoutRef.current();
      navigateRef.current('/login');
    }
    return res;
  }, []);
}
