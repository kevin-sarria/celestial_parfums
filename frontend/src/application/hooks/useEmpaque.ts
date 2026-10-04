import { useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
import type { ReglaEmpaque } from '../../pages/dashboard/pedido/empaque.calculo';

/** Lo que devuelve `GET /api/empaque`: las reglas, los accesorios y las tallas. */
export interface ConfigEmpaque {
  reglas: ReglaEmpaque[];
  accesorios: { id: number; nombre: string; publicado: boolean }[];
  tallas: { id: number; nombre: string; ml: number | null }[];
}

/**
 * El empaque por línea y talla (2026-10-04). Lo piden Ventas, Créditos y la
 * pantalla Empaque; se guarda en memoria y la pantalla lo olvida al guardar
 * (`olvidarEmpaque`). Sin él, la venta simplemente no ofrece empaque: nunca
 * bloquea el registrar.
 */
export function useEmpaque(habilitado = true) {
  const [config, setConfig] = useState<ConfigEmpaque | null>(null);
  useEffect(() => {
    if (!habilitado) return;
    let vivo = true;
    http.getCacheado<{ data: ConfigEmpaque }>(urls.empaque)
      .then(r => { if (vivo && r.ok && r.cuerpo) setConfig(r.cuerpo.data); })
      .catch(() => { /* sin empaque, la venta sigue */ });
    return () => { vivo = false; };
  }, [habilitado]);
  return config;
}

export const olvidarEmpaque = () => http.olvidar(urls.empaque);
