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
  /** Ventas de 1.1 que se costearon con esos accesorios (ver `ventasDe11Costo.ts`). */
  ventas: {
    ventas: { movimiento_id: number; venta_id: number; fecha: string; ficha: string; antes: number; ahora: number; valor: number }[];
    valor: number;
  };
}

interface Corregido { lotes: number; valor: number; ventas: number; valor_ventas: number }

/**
 * Lotes que cargaron accesorios que su ficha no lleva.
 *
 * Hasta el 2026-09-27 todo lote cobraba la bolsa y el perfumero de la RECETA,
 * aunque fuera un 1.1 que no los lleva. En producción eran 27 lotes y $54.300.
 * El dueño decidió corregirlos; aquí ve la cifra antes de hacerlo, y el aviso
 * desaparece solo cuando ya no queda nada (se recalcula, no se guarda).
 *
 * Desde el 2026-09-29 también las VENTAS que salieron de esos frascos (opción B
 * del dueño). En producción los lotes ya estaban corregidos, así que allá el
 * aviso sale solo con las ventas.
 */
export function AccesoriosSobrantes({ onCorregido }: { onCorregido: () => void }) {
  const { dato, fallo, cargando, recargar } = useConsultaDeApoyo<Revision>(urls.inventario.accesoriosSobrantes);
  const [corrigiendo, setCorrigiendo] = useState(false);

  if (cargando) return null;
  // No poder preguntar no es lo mismo que no tener nada (ver LotesPorEnlazar).
  if (fallo) return <Section><NoSePudoCargar que="si hay lotes con accesorios de más" onReintentar={recargar} /></Section>;
  const ventas = dato?.ventas?.ventas ?? [];
  if (!dato || (dato.lotes.length === 0 && ventas.length === 0)) return null;
  const hayLotes = dato.lotes.length > 0;

  const porAccesorio = new Map<string, number>();
  dato.lotes.flatMap((l) => l.insumos).forEach((i) => porAccesorio.set(i.nombre, (porAccesorio.get(i.nombre) ?? 0) + i.unidades));

  const corregir = async () => {
    const mensaje = hayLotes
      ? `Se devuelven al inventario ${[...porAccesorio].map(([n, u]) => `${u} × ${n}`).join(' y ')}, `
        + `y a esos ${dato.lotes.length} lotes y sus frascos se les baja ${formatPrice(dato.valor)} de costo.\n\n`
        + 'También se baja el costo de las ventas que ya salieron de esos frascos.'
      : `A ${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'} de 1.1 se les baja ${formatPrice(dato.ventas.valor)} `
        + 'de costo: se costearon con la bolsa y el perfumero que el frasco no llevaba. Tu ganancia de esos meses sube eso.';
    if (!window.confirm(mensaje)) return;
    setCorrigiendo(true);
    try {
      const res = await http.post<{ data: Corregido }>(urls.inventario.corregirAccesoriosSobrantes, {});
      if (!res.ok) { toast.error(res.error, { id: 'accesorios-sobrantes' }); return; }
      const d = res.cuerpo?.data;
      toast.success([
        d?.lotes ? `${d.lotes} lotes corregidos (${formatPrice(d.valor)})` : '',
        d?.ventas ? `${d.ventas} ventas corregidas (${formatPrice(d.valor_ventas)})` : '',
      ].filter(Boolean).join(' y ') || 'No quedaba nada por corregir');
      recargar(); onCorregido();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'accesorios-sobrantes' }); }
    finally { setCorrigiendo(false); }
  };

  return (
    <Section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hayLotes ? (
            <>
              <p className="text-[13px] font-semibold text-amber-700">
                ⚠ {dato.lotes.length} {dato.lotes.length === 1 ? 'lote cargó' : 'lotes cargaron'} accesorios que no llevan:{' '}
                {formatPrice(dato.valor)}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {[...porAccesorio].map(([n, u]) => `${u} × ${n}`).join(' · ')}. Salieron de la bodega sin usarse y
                quedaron sumados al costo de los frascos. Corregir los devuelve, baja ese costo y el de las ventas
                que ya salieron de esos frascos.
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-amber-700">
                ⚠ {ventas.length} {ventas.length === 1 ? 'venta de 1.1 quedó' : 'ventas de 1.1 quedaron'} con{' '}
                {formatPrice(dato.ventas.valor)} de costo de más
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Se costearon con la bolsa y el perfumero que el frasco no llevaba, así que tu ganancia de esos
                meses se ve más baja de lo real. Corregir les baja ese costo.
              </p>
            </>
          )}
        </div>
        <Button size="sm" onClick={corregir} disabled={corrigiendo}>
          {corrigiendo ? 'Corrigiendo…' : 'Corregir'}
        </Button>
      </div>
      {hayLotes && (
        <details className="mt-2 text-[12.5px]">
          <summary className="cursor-pointer font-medium text-primary">
            {dato.lotes.length === 1 ? 'Ver el lote' : `Ver los ${dato.lotes.length} lotes`}
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
      )}
      {ventas.length > 0 && (
        <details className="mt-2 text-[12.5px]">
          <summary className="cursor-pointer font-medium text-primary">
            {ventas.length === 1 ? 'Ver la venta' : `Ver las ${ventas.length} ventas`}
          </summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {ventas.map((v) => (
              <li key={v.movimiento_id} className="flex justify-between gap-3 tabular-nums">
                <span>{fmtDate(v.fecha)} · Venta #{v.venta_id} · {v.ficha}</span>
                <span className="text-muted-foreground">{formatPrice(v.antes)} → {formatPrice(v.ahora)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}
