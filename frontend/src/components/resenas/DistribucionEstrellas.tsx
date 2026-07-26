import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Cuenta por estrella (índice 0 = 1★ … 4 = 5★). */
  conteo: number[];
  total: number;
  /** Estrella filtrada (0 = ninguna). */
  filtro?: number;
  /** Si se pasa, las filas son clicables para filtrar. */
  onFiltro?: (estrella: number) => void;
}

/** Barras de distribución de calificaciones (5★ → 1★), estilo Mercado Libre. */
export default function DistribucionEstrellas({ conteo, total, filtro = 0, onFiltro }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {[5, 4, 3, 2, 1].map((s) => {
        const n = conteo[s - 1] ?? 0;
        const pct = total > 0 ? (n / total) * 100 : 0;
        const activo = filtro === s;
        const clicable = !!onFiltro;
        const contenido = (
          <>
            <span className="flex w-7 shrink-0 items-center gap-0.5 text-[12px] tabular-nums text-muted-foreground">
              {s}<Star className="size-3" style={{ color: '#d9b45a', fill: '#d9b45a' }} strokeWidth={0} />
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: '#d9b45a' }} />
            </span>
            <span className="w-6 shrink-0 text-right text-[11.5px] tabular-nums text-muted-foreground">{n}</span>
          </>
        );
        return clicable ? (
          <button key={s} type="button" disabled={n === 0}
            onClick={() => onFiltro!(activo ? 0 : s)}
            className={cn('flex items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors',
              n > 0 && 'hover:bg-muted/60', activo && 'bg-brand-soft/60', n === 0 && 'cursor-default opacity-60')}>
            {contenido}
          </button>
        ) : (
          <div key={s} className="flex items-center gap-2 px-1 py-0.5">{contenido}</div>
        );
      })}
    </div>
  );
}
