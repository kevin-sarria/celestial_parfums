import { useState, type ReactNode } from 'react';
import { authStorage } from '../../infrastructure/storage/auth.storage';
import type { AuthUser } from '../../domain/entities/auth.schema';
import { AuthContext } from './AuthContext';

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

  return (
    <AuthContext.Provider value={{ user, token, isAdmin: user?.rol_id === 1, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}