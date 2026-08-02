import { useState } from 'react';

/**
 * Paleta de series. Validada con el script del design system contra superficie
 * blanca: banda de luminosidad, piso de croma, separación para daltonismo
 * (ΔE 28,1 protan / 16,9 tritan) y contraste ≥ 3:1 — todo PASS.
 * NO usar el iris de marca (#524276) en barras: es muy oscuro y de croma bajo
 * para un slot categórico, y el validador lo rechaza.
 */
export const SERIE_A = '#8661cc';
export const SERIE_B = '#c78200';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-08" → "ago 26". Se parte la cadena: `new Date` la leería en UTC y restaría un día. */
export const etiquetaMes = (mes: string) => {
  const [a, m] = mes.split('-');
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
};

export interface Serie {
  /** Campo del dato que dibuja esta serie. */
  clave: string;
  nombre: string;
  color: string;
}

interface Props {
  /** Cada fila necesita `mes` y un número por cada `clave` de las series. */
  datos: Record<string, number | string>[];
  series: Serie[];
  titulo: string;
  /** Cómo se escribe cada valor (pesos, unidades, personas…). */
  formato: (n: number) => string;
  /** Texto bajo el gráfico cuando algo todavía no se puede calcular. */
  nota?: string;
}

/**
 * Barras por mes, apiladas cuando hay más de una serie.
 *
 * Apiladas y no lado a lado porque las partes SUMAN el total y comparten
 * escala. Nunca dos ejes: dos medidas de escalas distintas van en dos gráficos.
 */
export default function GraficoBarras({ datos, series, titulo, formato, nota }: Props) {
  const [activo, setActivo] = useState<number | null>(null);

  const totalDe = (d: Record<string, number | string>) =>
    series.reduce((s, serie) => s + Math.max(Number(d[serie.clave]) || 0, 0), 0);

  const tope = Math.max(...datos.map(totalDe), 1);
  // Una serie que en todo el periodo suma 0 no se anuncia: la leyenda solo
  // nombra lo que de verdad se ve dibujado.
  const visibles = series.filter((s) => datos.some((d) => (Number(d[s.clave]) || 0) > 0));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {titulo}
        </h3>
        {/* Con dos o más series la leyenda es obligatoria: la identidad nunca
            depende solo del color. Con una sola, el título ya la nombra. */}
        {visibles.length > 1 && (
          <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
            {visibles.map((s) => (
              <span key={s.clave} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
                {s.nombre}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height: 190 }}>
        {datos.map((d, i) => {
          const total = totalDe(d);
          const alto = (total / tope) * 150;
          const atenuado = activo !== null && activo !== i;
          return (
            <div key={String(d.mes)} className="flex min-w-11 flex-1 flex-col items-center gap-1"
              onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}>
              <div className="relative flex w-full flex-col justify-end" style={{ height: 150 }}>
                {activo === i && total !== 0 && (
                  <div className="absolute -top-1 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11.5px] shadow-md">
                    <p className="font-medium text-foreground">{etiquetaMes(String(d.mes))}</p>
                    {visibles.map((s) => (
                      <p key={s.clave} className="text-muted-foreground">
                        {s.nombre}: {formato(Number(d[s.clave]) || 0)}
                      </p>
                    ))}
                    {visibles.length > 1 && (
                      <p className="border-t border-border/70 pt-0.5 font-medium text-foreground">
                        Total {formato(total)}
                      </p>
                    )}
                  </div>
                )}
                {/* De arriba abajo: la primera serie corona la barra, con el
                    extremo redondeado; las demás se apilan debajo con 2px de aire. */}
                {visibles.map((s, j) => {
                  const parte = total > 0 ? ((Number(d[s.clave]) || 0) / total) * alto : 0;
                  if (parte <= 0) return null;
                  return (
                    <div key={s.clave} className="w-full transition-opacity"
                      style={{
                        height: parte, background: s.color,
                        borderTopLeftRadius: j === 0 ? 4 : 0, borderTopRightRadius: j === 0 ? 4 : 0,
                        marginTop: j === 0 ? 0 : 2,
                        opacity: atenuado ? 0.55 : 1,
                      }} />
                  );
                })}
              </div>
              <span className="text-[10.5px] text-muted-foreground">{etiquetaMes(String(d.mes))}</span>
            </div>
          );
        })}
      </div>

      {/* Tabla equivalente: el gráfico nunca es la única forma de leer el dato */}
      <details className="mt-2">
        <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground">
          Ver los números
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="py-1.5 pr-3 font-semibold">Mes</th>
                {visibles.map((s) => (
                  <th key={s.clave} className="py-1.5 pr-3 text-right font-semibold">{s.nombre}</th>
                ))}
                {visibles.length > 1 && <th className="py-1.5 text-right font-semibold">Total</th>}
              </tr>
            </thead>
            <tbody>
              {datos.filter((d) => totalDe(d) !== 0).map((d) => (
                <tr key={String(d.mes)} className="border-b border-border/60">
                  <td className="py-1.5 pr-3 text-foreground">{etiquetaMes(String(d.mes))}</td>
                  {visibles.map((s) => (
                    <td key={s.clave} className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {formato(Number(d[s.clave]) || 0)}
                    </td>
                  ))}
                  {visibles.length > 1 && (
                    <td className="py-1.5 text-right tabular-nums font-medium text-foreground">
                      {formato(totalDe(d))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {nota && <p className="mt-2 text-[12px] text-muted-foreground">{nota}</p>}
    </div>
  );
}
