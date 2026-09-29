import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import type { Perfume } from '../../../../domain/entities/perfume.schema';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';

export interface ItemDelKit { perfume_id: number; nombre: string; cantidad: number }

/**
 * "¿Qué trae este combo por defecto?" — el kit del combo (2026-09-28, ola 2 de
 * los regalos). Solo accesorios (perfumero, bolsa, tarjeta): al vender el
 * combo se ofrecen con un botón y entran como regalo.
 *
 * Una sola combinación por combo, a propósito (decidido con el dueño): si un
 * cliente pide otra cosa, se ajusta la línea en la venta.
 */
export function KitDelComboEditor({ valor, onChange }: { valor: ItemDelKit[]; onChange: (kit: ItemDelKit[]) => void }) {
  const [accesorios, setAccesorios] = useState<Perfume[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await http.getCacheado<{ data: { data: Perfume[] } | Perfume[] }>(urls.perfumes.todosConOcultos);
        // /api/parfums sin paginar responde { data: { data: [...] } }
        const pf = res.cuerpo?.data;
        const lista = Array.isArray(pf) ? pf : (pf?.data ?? []);
        if (vivo) setAccesorios(lista.filter(p => p.es_accesorio).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      } catch { if (vivo) setError(true); }
    })();
    return () => { vivo = false; };
  }, []);

  const agregar = (id: number) => {
    const p = accesorios?.find(a => a.id === id);
    if (!p) return;
    const i = valor.findIndex(k => k.perfume_id === id);
    onChange(i >= 0
      ? valor.map((k, j) => (j === i ? { ...k, cantidad: k.cantidad + 1 } : k))
      : [...valor, { perfume_id: id, nombre: p.nombre, cantidad: 1 }]);
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-[12.5px] text-destructive">No se pudieron cargar los accesorios. Cierra y vuelve a abrir.</p>}
      {accesorios && accesorios.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground">
          Todavía no hay accesorios. Crea uno en Productos (algo que compras hecho, marcado como accesorio).
        </p>
      )}
      {accesorios && accesorios.length > 0 && (
        <BuscadorSelect
          opciones={accesorios.map(p => ({ id: p.id, nombre: p.nombre }))}
          placeholder="Agregar accesorio (perfumero, bolsa, tarjeta…)"
          vacio="Sin accesorios"
          onSelect={id => agregar(Number(id))}
        />
      )}
      {valor.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {valor.map(k => (
            <li key={k.perfume_id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">{k.nombre}</span>
              <Input
                type="number" min="1" max="99" inputMode="numeric" aria-label={`Cantidad de ${k.nombre}`}
                className="h-9 w-16 text-center sm:h-8"
                value={k.cantidad}
                onChange={e => {
                  const n = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                  onChange(valor.map(x => (x.perfume_id === k.perfume_id ? { ...x, cantidad: n } : x)));
                }}
              />
              <button type="button" onClick={() => onChange(valor.filter(x => x.perfume_id !== k.perfume_id))}
                aria-label={`Quitar ${k.nombre} del kit`}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
