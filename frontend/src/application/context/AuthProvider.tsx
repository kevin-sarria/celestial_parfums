import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStorage } from '../../infrastructure/storage/auth.storage';
import { http, registrarSesionCaducada } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
import type { AuthUser } from '../../domain/entities/auth.schema';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authStorage.getUser());
  const [isAdmin, setIsAdmin] = useState(() => user?.rol_id === 1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      /**
       * `sesionOpcional` es OBLIGATORIO aquí: esta es la primera petición que
       * hace la aplicación al arrancar, y para un visitante anónimo responde
       * 401. Sin la marca, el interceptor lo leería como "tu sesión venció" y
       * **rebotaría al login a cualquiera que abra la tienda**.
       */
      const res = await http.get<{ data?: AuthUser }>(urls.auth.yo, { sesionOpcional: true });
      const perfil = res.cuerpo?.data;
      if (perfil) {
        setUser(prev => prev ?? perfil);
        setIsAdmin(perfil.rol_id === 1);
      } else if (res.status === 401) {
        // El servidor CONFIRMA que no hay sesión: se limpia lo que quedara.
        setUser(null);
        setIsAdmin(false);
        authStorage.clear();
      }
      // Con el servidor caído no se toca nada: borrar la sesión guardada por un
      // fallo de red desloguearía al dueño cada vez que parpadea el internet.
      setReady(true);
    })();
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
    /**
     * Falle o no, aquí se sale. No es un handler mudo: cerrar sesión es
     * justamente lo que se quiere, y avisar de un fallo al salir solo asusta.
     * Va con `sesionOpcional` porque una sesión ya muerta responde 401, y sin
     * la marca el interceptor llamaría a `alCaducar`, que llama a este mismo
     * `logout`.
     */
    await http.post(urls.auth.logout, undefined, { sesionOpcional: true });
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
