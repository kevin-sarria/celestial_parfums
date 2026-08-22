import { useCallback, useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
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
  /**
   * Por qué se devuelve el error y no se traga: sin tarjeta la pantalla dice
   * "el programa no está activo por ahora", y eso sería MENTIRA cuando lo que
   * pasó es que la petición falló. Quien la pinta decide qué enseñar.
   */
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user || isAdmin) { setData(null); setError(''); return; }
    setLoading(true);
    const res = await http.get<{ data: MiTarjeta }>(urls.recompensas.miTarjeta);
    setData(res.cuerpo?.data ?? null);
    setError(res.ok ? '' : res.error);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
