import { useCallback, useEffect, useState } from 'react';
import { BASE_URL, authFetchWithRefresh } from '../../infrastructure/api/client';
import { useAuthContext } from '../context/useAuthContext';

export interface AbonoPortal {
  monto: number;
  fecha: string;
}

export interface CreditoPortal {
  id: number;
  fecha: string;
  articulos: string;
  deuda_inicial: number;
  abonado: number;
  saldo: number;
  abonos: AbonoPortal[];
}

export interface PortalCredito {
  tiene_credito_activo: boolean;
  deuda_total?: number;
  creditos?: CreditoPortal[];
}

/**
 * Crédito del cliente logueado (solo consulta: deuda y cuotas pagadas;
 * los créditos los otorga el admin). Para visitantes no hace nada.
 */
export function usePortalCredito() {
  const { user, isAdmin } = useAuthContext();
  const [data, setData] = useState<PortalCredito | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || isAdmin) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetchWithRefresh(`${BASE_URL}/api/portal/credito`);
      const json = await res.json();
      setData(res.ok ? json.data : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
