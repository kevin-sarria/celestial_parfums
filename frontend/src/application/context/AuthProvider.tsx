import { useState, useEffect, type ReactNode } from 'react';
import { authStorage } from '../../infrastructure/storage/auth.storage';
import { BASE_URL } from '../../infrastructure/api/client';
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

  const login = (_token: string, newUser: AuthUser) => {
    authStorage.save('', newUser);
    setUser(newUser);
    setIsAdmin(newUser.rol_id === 1);
  };

  const logout = async () => {
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    authStorage.clearAll();
    setUser(null);
    setIsAdmin(false);
  };

  if (!ready) return null;

  return (
    <AuthContext.Provider value={{ user, token: null, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
