import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BASE_URL, authFetchWithRefresh } from '../../infrastructure/api/client';
import { useAuthContext } from './useAuthContext';
import { ListasContext } from './ListasContext';

/**
 * Carga (una sola vez por sesión) los favoritos y avisos de stock del cliente y
 * expone toggles optimistas. Los invitados quedan con Sets vacíos.
 */
export function ListasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [favoritos, setFavoritos] = useState<Set<number>>(new Set());
  const [avisos, setAvisos] = useState<Set<number>>(new Set());

  const recargar = useCallback(() => {
    if (!user) {
      setFavoritos(new Set());
      setAvisos(new Set());
      return;
    }
    authFetchWithRefresh(`${BASE_URL}/api/favoritos`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setFavoritos(new Set<number>(j.data ?? [])))
      .catch(() => {});
    authFetchWithRefresh(`${BASE_URL}/api/avisos/mios`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setAvisos(new Set<number>(j.data ?? [])))
      .catch(() => {});
  }, [user]);

  useEffect(() => { recargar(); }, [recargar]);

  const toggleFavorito = useCallback((perfumeId: number) => {
    if (!user) return;
    setFavoritos((prev) => {
      const next = new Set(prev);
      next.has(perfumeId) ? next.delete(perfumeId) : next.add(perfumeId);
      return next;
    });
    authFetchWithRefresh(`${BASE_URL}/api/favoritos/${perfumeId}`, { method: 'POST' }).catch(() => recargar());
  }, [user, recargar]);

  const toggleAviso = useCallback((perfumeId: number) => {
    if (!user) return;
    const activo = avisos.has(perfumeId);
    setAvisos((prev) => {
      const next = new Set(prev);
      activo ? next.delete(perfumeId) : next.add(perfumeId);
      return next;
    });
    authFetchWithRefresh(`${BASE_URL}/api/avisos/${perfumeId}`, { method: activo ? 'DELETE' : 'POST' }).catch(() => recargar());
  }, [avisos, user, recargar]);

  return (
    <ListasContext.Provider value={{ favoritos, avisos, toggleFavorito, toggleAviso, recargar }}>
      {children}
    </ListasContext.Provider>
  );
}
