import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { EncabezadoPagina, Section } from '../ui';
import { partirRanking, porcentajeTexto } from './ranking';

/**
 * Piezas que comparten los tres reportes (ventas, compras y clientes).
 *
 * Cada reporte es su propia pestaña porque son preguntas distintas: cuánto
 * vendí, cuánto gasté y quién me compra. Meterlas en una sola pantalla era
 * justo lo que se sentía incómodo.
 */

/** Carga un reporte con su spinner, su error y su botón de reintentar. */
export function useReporte<T>(ruta: string, params?: Record<string, string>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /** Los parámetros como texto: un objeto nuevo en cada render recargaría sin fin. */
  const clave = JSON.stringify(params ?? {});

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: T }>(urls.reportes(ruta), { params: JSON.parse(clave) });
      if (!res.ok) throw new Error(res.error);
      setDatos(res.cuerpo?.data ?? null);
      setError('');
    } catch (e) {
      // Sin este catch/finally la pantalla se queda "Cargando…" para siempre
      // si la petición falla (429, sin conexión) y parece que se colgó.
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte');
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  return { datos, cargando, error, recargar: cargar };
}

interface ShellProps {
  titulo: string;
  cargando: boolean;
  error: string;
  onReintentar: () => void;
  /** Controles del reporte (por ejemplo, el periodo a mostrar). */
  acciones?: ReactNode;
  children: ReactNode;
}

export function ReporteShell({ titulo, cargando, error, onReintentar, acciones, children }: ShellProps) {
  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo={titulo}>{acciones}</EncabezadoPagina>

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={onReintentar}>Reintentar</Button>
        </p>
      )}

      {cargando ? <Section><PerfumeSpinner /></Section> : children}
    </div>
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
  /** Cuántas filas se ven antes de agrupar la cola. */
  cuantas?: number;
}

/**
 * Ranking con barra proporcional. La barra es el dato; el número va SIEMPRE al
 * lado en texto normal (nunca coloreado): el color identifica, no informa.
 *
 * Tres cosas que aprendió de un reporte real (2026-10-04), donde el panel de
 * insumos pintaba **127 filas** y el de ventas **~170**:
 *
 * 1. **La cola se agrupa.** Pasado el tope, una sola fila dice cuántos quedaron
 *    y cuánto suman. Una lista de 127 renglones donde el primero pesa el 4,7 %
 *    no se lee, se sufre.
 * 2. **Cada fila dice su PORCENTAJE del total**, que es el número con el que se
 *    decide ("el 41 % se fue en botellas"). La barra, en cambio, sigue midiendo
 *    contra la más grande, que es lo que aprovecha el ancho.
 * 3. **El detalle va pegado al nombre**, no en el borde derecho: "21 pedidos"
 *    debajo del valor obliga a cruzar la pantalla con la mirada.
 */
export function Ranking({ titulo, filas, formato, vacio, color, cuantas }: RankingProps) {
  const { visibles, mayor, total, cola } = partirRanking(filas, cuantas);
  return (
    <Panel>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {titulo}
      </h3>
      {filas.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((f, i) => (
            <li key={`${f.nombre}-${i}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate text-[13px] text-foreground">{f.nombre}</span>
                  {/* El detalle NO se trunca: en el celular "1 pedido" quedaba en
                      "1 pe…". El que cede es el nombre, que igual se reconoce. */}
                  {f.detalle && (
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{f.detalle}</span>
                  )}
                </span>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
                  {formato(f.valor)}
                  <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                    {porcentajeTexto(f.valor, total)}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(f.valor / mayor) * 100}%`, background: color }}
                />
              </div>
            </li>
          ))}

          {cola && (
            <li className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-2 text-[12px] text-muted-foreground">
              <span>Otros {cola.cuantas}</span>
              <span className="shrink-0 tabular-nums">
                {formato(cola.total)} <span className="ml-1">{porcentajeTexto(cola.total, total)}</span>
              </span>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}
