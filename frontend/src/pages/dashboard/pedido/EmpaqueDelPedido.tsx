import { useEffect, useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import type { Combo } from '../../../domain/entities/combo.schema';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { useEmpaque } from '../../../application/hooks/useEmpaque';
import { agregarComoRegalo, empaquePendiente, type ItemDelKit } from './empaque.calculo';
import type { LineaPedido } from './lineasPedido';

/**
 * El estado del bloque "Este pedido lleva" (2026-10-04).
 *
 * Lo pendiente se recalcula con cada cambio del pedido. Al REGISTRAR viene
 * todo marcado (lo normal es que lleve su empaque); al CORREGIR una venta ya
 * guardada viene desmarcado, porque su empaque ya se decidió el día que se
 * registró y volver a agregarlo de oficio lo duplicaría.
 *
 * `conEmpaque` es lo que el formulario manda al guardar: sus líneas más lo
 * marcado, como regalo.
 */
export function useEmpaqueDelPedido({ abierto, lineas, porId, combos, editando }: {
  /** Al abrir el formulario se olvida lo que se desmarcó la vez anterior. */
  abierto: boolean;
  lineas: LineaPedido[];
  porId: Map<number, Perfume>;
  combos: Combo[];
  editando: boolean;
}) {
  const config = useEmpaque();
  const [cambios, setCambios] = useState<Map<number, boolean>>(new Map());
  useEffect(() => { if (abierto) setCambios(new Map()); }, [abierto]);
  const pendiente = useMemo(
    () => (config ? empaquePendiente(lineas, porId, combos, config.reglas) : []),
    [config, lineas, porId, combos],
  );
  const marcado = (id: number) => cambios.get(id) ?? !editando;
  const alternar = (id: number) => setCambios(m => new Map(m).set(id, !marcado(id)));
  const conEmpaque = (base: LineaPedido[]) => agregarComoRegalo(base, pendiente.filter(k => marcado(k.perfume_id)), porId);
  return { pendiente, marcado, alternar, conEmpaque };
}

/**
 * "Este pedido lleva: ☑ Bolsa ×2 · ☑ Perfumero ×2". Reemplaza al aviso del kit
 * del combo: el kit es un caso más del empaque. Lo comparten Ventas y Créditos.
 */
export function EmpaqueDelPedido({ pendiente, marcado, alternar }: {
  pendiente: ItemDelKit[];
  marcado: (id: number) => boolean;
  alternar: (id: number) => void;
}) {
  if (pendiente.length === 0) return null;
  return (
    <div className="rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2.5">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-primary">
        <Gift className="size-4 shrink-0" /> Este pedido lleva
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {pendiente.map(k => (
          <label key={k.perfume_id} className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" className="size-4 accent-primary" checked={marcado(k.perfume_id)}
              onChange={() => alternar(k.perfume_id)} />
            {k.nombre} ×{k.cantidad}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">Va de regalo al guardar. Desmarca lo que no lleve.</p>
    </div>
  );
}
