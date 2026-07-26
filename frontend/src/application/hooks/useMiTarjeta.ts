import { useCallback, useEffect, useState } from 'react';
import { BASE_URL, authFetchWithRefresh } from '../../infrastructure/api/client';
import { useAuthContext } from '../context/useAuthContext';

/** Colores configurables de la tarjeta. */
export interface ColoresTarjeta {
  fondo: string;
  lineas: string;
  texto: string;
}

/** Tarjeta de recompensas del cliente logueado (sellos calculados del historial). */
export interface MiTarjeta {
  activo: boolean;
  objetivo: number;
  premio: string;
  min_compra: number;
  sellos: number;
  faltan: number;
  premio_listo: boolean;
  premios_listos: number;
  premios_entregados: number;
  sellos_historicos: number;
  colores: ColoresTarjeta;
}

export function useMiTarjeta() {
  const { user, isAdmin } = useAuthContext();
  const [data, setData] = useState<MiTarjeta | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || isAdmin) { setData(null); return; }
    setLoading(true);
    try {
      const res = await authFetchWithRefresh(`${BASE_URL}/api/recompensas/mi-tarjeta`);
      const json = await res.json();
      setData(res.ok ? json.data : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}
