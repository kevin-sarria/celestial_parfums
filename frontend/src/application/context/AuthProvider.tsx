import { useState, type ReactNode } from 'react';
import { authStorage } from '../../infrastructure/storage/auth.storage';
import type { AuthUser } from '../../domain/entities/auth.schema';
import { AuthContext } from './AuthContext';

/** Decode JWT payload without verifying — verification happens on the server.
 *  Reading rol_id from the token is more tamper-resistant than from the stored user object,
 *  because any modification to the JWT invalidates its signature server-side. */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function resolveIsAdmin(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJWTPayload(token);
  return payload?.rol_id === 1;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authStorage.getUser());
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());

  const login = (newToken: string, newUser: AuthUser) => {
    authStorage.save(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    authStorage.clear();
    setToken(null);
    setUser(null);
  };

  // isAdmin is derived from the JWT payload, not from the mutable localStorage user object
  const isAdmin = resolveIsAdmin(token);

  return (
    <AuthContext.Provider value={{ user, token, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
