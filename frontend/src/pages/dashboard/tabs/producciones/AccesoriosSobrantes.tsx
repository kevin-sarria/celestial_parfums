import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { useConsultaDeApoyo } from '../../../../application/hooks/useConsultaDeApoyo';
import { NoSePudoCargar } from '../../../../components/NoSePudoCargar';
import { fmtDate, formatPrice } from '../../helpers';
import { Section } from '../../ui';

interface Revision {
  lotes: {
    lote_id: number; fecha: string; ficha: string | null; cantidad: number; valor: number;
    insumos: { insumo_id: number; nombre: string; unidades: number; valor: number }[];
  }[];
  valor: number;
  unidades: number;
}

/**
 * Lotes que cargaron accesorios que su ficha no lleva.
 *
 * Hasta el 2026-09-27 todo lote cobraba la bolsa y el perfumero de la RECETA,
 * aunque fuera un 1.1 que no los lleva. En producción eran 27 lotes y $54.300.
 * El dueño decidió corregirlos; aquí ve la cifra antes de hacerlo, y el aviso
 * desaparece solo cuando ya no queda nada (se recalcula, no se guarda).
 */
export function AccesoriosSobrantes({ onCorregido }: { onCorregido: () => void }) {
  const { dato, fallo, cargando, recargar } = useConsultaDeApoyo<Revision>(urls.inventario.accesoriosSobrantes);
  const [corrigiendo, setCorrigiendo] = useState(false);

  if (cargando) return null;
  // No poder preguntar no es lo mismo que no tener nada (ver LotesPorEnlazar).
  if (fallo) return <Section><NoSePudoCargar que="si hay lotes con accesorios de más" onReintentar={recargar} /></Section>;
  if (!dato || dato.lotes.length === 0) return null;

  const porAccesorio = new Map<string, number>();
  dato.lotes.flatMap((l) => l.insumos).forEach((i) => porAccesorio.set(i.nombre, (porAccesorio.get(i.nombre) ?? 0) + i.unidades));

  const corregir = async () => {
    if (!window.confirm(
      `Se devuelven al inventario ${[...porAccesorio].map(([n, u]) => `${u} × ${n}`).join(' y ')}, `
      + `y a esos ${dato.lotes.length} lotes y sus frascos se les baja ${formatPrice(dato.valor)} de costo.\n\n`
      + 'Las ventas que ya se hicieron conservan su costo.',
    )) return;
    setCorrigiendo(true);
    try {
      const res = await http.post<{ data: { lotes: number; valor: number } }>(urls.inventario.corregirAccesoriosSobrantes, {});
      if (!res.ok) { toast.error(res.error, { id: 'accesorios-sobrantes' }); return; }
      toast.success(`Listo: ${res.cuerpo?.data.lotes ?? 0} lotes corregidos, ${formatPrice(res.cuerpo?.data.valor ?? 0)} de menos en su costo`);
      recargar(); onCorregido();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'accesorios-sobrantes' }); }
    finally { setCorrigiendo(false); }
  };

  return (
    <Section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-amber-700">
            ⚠ {dato.lotes.length} {dato.lotes.length === 1 ? 'lote cargó' : 'lotes cargaron'} accesorios que no llevan:{' '}
            {formatPrice(dato.valor)}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {[...porAccesorio].map(([n, u]) => `${u} × ${n}`).join(' · ')}. Salieron de la bodega sin usarse y
            quedaron sumados al costo de los frascos. Corregir los devuelve y baja ese costo.
          </p>
        </div>
        <Button size="sm" onClick={corregir} disabled={corrigiendo}>
          {corrigiendo ? 'Corrigiendo…' : 'Corregir'}
        </Button>
      </div>
      <details className="mt-2 text-[12.5px]">
        <summary className="cursor-pointer font-medium text-primary">
          {dato.lotes.length === 1 ? "Ver el lote" : `Ver los ${dato.lotes.length} lotes`}
        </summary>
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {dato.lotes.map((l) => (
            <li key={l.lote_id} className="flex justify-between gap-3 tabular-nums">
              <span>{fmtDate(l.fecha)} · {l.ficha ?? `Lote #${l.lote_id}`}</span>
              <span className="text-muted-foreground">{l.insumos.map((i) => i.nombre).join(' + ')} · {formatPrice(l.valor)}</span>
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}
