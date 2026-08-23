import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
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

  /**
   * Las dos listas se piden a la vez y en silencio: son adorno de las cards
   * (el corazón y la campana), no el contenido de ninguna pantalla, y este
   * proveedor envuelve la tienda entera. Lo que SÍ avisa es cambiarlas —
   * ahí el cliente acaba de tocar algo y espera una respuesta.
   */
  const recargar = useCallback(async () => {
    if (!user) {
      setFavoritos(new Set());
      setAvisos(new Set());
      return;
    }
    const [favs, avs] = await Promise.all([
      http.get<{ data: number[] }>(urls.favoritos.mios),
      http.get<{ data: number[] }>(urls.avisos.mios),
    ]);
    setFavoritos(new Set(favs.cuerpo?.data ?? []));
    setAvisos(new Set(avs.cuerpo?.data ?? []));
  }, [user]);

  useEffect(() => { recargar(); }, [recargar]);

  const toggleFavorito = useCallback(async (perfumeId: number) => {
    if (!user) return;
    setFavoritos((prev) => {
      const next = new Set(prev);
      if (next.has(perfumeId)) next.delete(perfumeId);
      else next.add(perfumeId);
      return next;
    });
    // El corazón ya cambió en la pantalla. Si el servidor no lo aceptó, se
    // vuelve a lo que él diga y se explica: un corazón que se deshace solo,
    // sin una palabra, parece que la aplicación está rota.
    const res = await http.post(urls.favoritos.alternar(perfumeId));
    if (!res.ok) { toast.error(res.error, { id: 'favoritos' }); recargar(); }
  }, [user, recargar]);

  const toggleAviso = useCallback(async (perfumeId: number) => {
    if (!user) return;
    const activo = avisos.has(perfumeId);
    setAvisos((prev) => {
      const next = new Set(prev);
      if (activo) next.delete(perfumeId);
      else next.add(perfumeId);
      return next;
    });
    const ruta = urls.avisos.aviso(perfumeId);
    const res = activo ? await http.borrar(ruta) : await http.post(ruta);
    if (!res.ok) { toast.error(res.error, { id: 'avisos-cliente' }); recargar(); }
  }, [avisos, user, recargar]);

  return (
    <ListasContext.Provider value={{ favoritos, avisos, toggleFavorito, toggleAviso, recargar }}>
      {children}
    </ListasContext.Provider>
  );
}
