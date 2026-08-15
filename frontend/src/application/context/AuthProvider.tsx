import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStorage } from '../../infrastructure/storage/auth.storage';
import { BASE_URL } from '../../infrastructure/api/client';
import { registrarSesionCaducada } from '../../infrastructure/api/http';
import type { AuthUser } from '../../domain/entities/auth.schema';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authStorage.getUser());
  const [isAdmin, setIsAdmin] = useState(() => user?.rol_id === 1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data) {
          setUser(prev => prev ?? json.data);
          setIsAdmin(json.data.rol_id === 1);
        } else {
          setUser(null);
          setIsAdmin(false);
          authStorage.clear();
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  /**
   * `login`, `logout` y el valor del contexto se MEMORIZAN, y no es cosmético.
   *
   * Este proveedor vive dentro del Router, así que cada cambio de ruta lo vuelve
   * a renderizar. Sin memorizar, en cada render nacían funciones nuevas y un
   * objeto de contexto nuevo; la función de red del dashboard dependía de
   * `logout`, así que también cambiaba de identidad, y el efecto de carga **se
   * volvía a disparar en cada cambio de pestaña**: cuatro clasificaciones, los
   * perfumes y los combos, otra vez, para ir a una pantalla que no los usa.
   * Medido el 2026-08-14: 11 peticiones por cambio de apartado, de las cuales
   * una sola hacía falta. (Desde el 2026-08-15 la red va por `http`, que no
   * depende de React; el consumidor de estos valores es la aplicación entera.)
   */
  const login = useCallback((_token: string, newUser: AuthUser) => {
    authStorage.save('', newUser);
    setUser(newUser);
    setIsAdmin(newUser.rol_id === 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    authStorage.clearAll();
    setUser(null);
    setIsAdmin(false);
  }, []);

  /**
   * Qué pasa cuando el servidor dice que la sesión ya no vale.
   *
   * El interceptor de `http` vive fuera de React, así que no puede cerrar
   * sesión ni navegar por su cuenta: se lo dejamos escrito aquí, en el único
   * sitio que sabe hacer las dos cosas. Antes esto vivía dentro de
   * `guardedFetch`, y por eso cada pantalla tenía que recibirlo como prop.
   */
  const navigate = useNavigate();
  useEffect(() => {
    registrarSesionCaducada(() => { logout(); navigate('/login'); });
    return () => registrarSesionCaducada(null);
  }, [logout, navigate]);

  const valor = useMemo(
    () => ({ user, token: null, isAdmin, login, logout }),
    [user, isAdmin, login, logout],
  );

  if (!ready) return null;

  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  );
}
