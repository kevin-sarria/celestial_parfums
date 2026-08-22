import { useCallback, useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
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
    // Sin toast a propósito: esto lo pide `CatalogHeader`, o sea TODAS las
    // páginas. Un servidor caído sacaría el mismo aviso una y otra vez encima
    // de la tienda. Si falla, el cliente simplemente no ve su deuda arriba;
    // la pantalla que la enseña de verdad es "Mi crédito".
    const res = await http.get<{ data: PortalCredito }>(urls.portal.credito);
    setData(res.cuerpo?.data ?? null);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
