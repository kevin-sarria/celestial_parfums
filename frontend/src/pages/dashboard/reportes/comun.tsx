import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { BASE_URL } from '../../../infrastructure/api/client';
import { Section, SectionTitle, Toolbar } from '../ui';
import type { GuardedFetch } from '../types';

/**
 * Piezas que comparten los tres reportes (ventas, compras y clientes).
 *
 * Cada reporte es su propia pestaña porque son preguntas distintas: cuánto
 * vendí, cuánto gasté y quién me compra. Meterlas en una sola pantalla era
 * justo lo que se sentía incómodo.
 */

/** Carga un reporte con su spinner, su error y su botón de reintentar. */
export function useReporte<T>(guardedFetch: GuardedFetch, ruta: string) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await guardedFetch(`${BASE_URL}/api/reportes/${ruta}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? 'No se pudo cargar el reporte');
      }
      setDatos((await res.json()).data ?? null);
      setError('');
    } catch (e) {
      // Sin este catch/finally la pantalla se queda "Cargando…" para siempre
      // si la petición falla (429, sin conexión) y parece que se colgó.
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte');
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { datos, cargando, error, recargar: cargar };
}

interface ShellProps {
  titulo: string;
  cargando: boolean;
  error: string;
  onReintentar: () => void;
  children: ReactNode;
}

export function ReporteShell({ titulo, cargando, error, onReintentar, children }: ShellProps) {
  return (
    <Section>
      <Toolbar><SectionTitle>{titulo}</SectionTitle></Toolbar>

      {error && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={onReintentar}>Reintentar</Button>
        </p>
      )}

      {cargando ? <PerfumeSpinner /> : children}
    </Section>
  );
}

/** Caja con el gráfico o una tabla adentro, para que todo respire igual. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</div>;
}

interface RankingProps {
  titulo: string;
  filas: { nombre: string; valor: number; detalle?: string }[];
  formato: (n: number) => string;
  vacio: string;
  color: string;
}

/**
 * Ranking con barra proporcional. La barra es el dato; el número va SIEMPRE al
 * lado en texto normal (nunca coloreado): el color identifica, no informa.
 */
export function Ranking({ titulo, filas, formato, vacio, color }: RankingProps) {
  const tope = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <Panel>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {titulo}
      </h3>
      {filas.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filas.map((f, i) => (
            <li key={`${f.nombre}-${i}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] text-foreground">{f.nombre}</span>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
                  {formato(f.valor)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full" style={{ width: `${(f.valor / tope) * 100}%`, background: color }} />
                </div>
                {f.detalle && <span className="shrink-0 text-[11.5px] text-muted-foreground">{f.detalle}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
