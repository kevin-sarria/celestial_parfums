import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatPrice } from '../../helpers';
import { etiquetaMes } from '../../GraficoBarras';
import { COBERTURA_COMPLETA, type MesReporte, type ReporteVentasRango } from './tipos';

/** Una cifra que puede no existir: "Sin datos" en gris, nunca un cero. */
export const dineroOSinDatos = (n: number | null) =>
  n == null ? <span className="text-muted-foreground/70">Sin datos</span> : formatPrice(n);

/**
 * La ganancia, marcada como PARCIAL si no todas las ventas tienen costo: con 1
 * de 20 ventas costeadas el número existe pero no es el del mes.
 */
export function Ganancia({ valor, cobertura }: { valor: number | null; cobertura: number | null }) {
  if (valor == null) return dineroOSinDatos(null);
  const parcial = cobertura != null && cobertura < COBERTURA_COMPLETA;
  return (
    <span className={cn(valor < 0 && 'text-destructive')}>
      {formatPrice(valor)}
      {parcial && (
        <span className="ml-1.5 whitespace-nowrap rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800"
          title={`Solo el ${cobertura}% de lo vendido tiene costo registrado`}>
          parcial · {cobertura}%
        </span>
      )}
    </span>
  );
}

const margen = (m: number | null) => (m == null ? dineroOSinDatos(null) : `${m.toLocaleString('es-CO')} %`);

const Th = ({ children, izq }: { children: ReactNode; izq?: boolean }) => (
  <th className={cn('whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground', izq ? 'sticky left-0 z-[1] bg-[color-mix(in_oklab,var(--color-secondary)_60%,var(--color-card))] text-left' : 'text-right')}>
    {children}
  </th>
);

const celda = 'whitespace-nowrap px-3 py-2 text-right tabular-nums';
/**
 * La columna del mes queda FIJA a la izquierda: en el celular la tabla se
 * desliza de lado para ver las 9 columnas, y sin esto se perdía de qué mes era
 * cada cifra. Lleva fondo propio para que las cifras no se vean pasar debajo.
 */
const fija = 'sticky left-0 z-[1] whitespace-nowrap bg-card px-3';

/**
 * El detalle mes a mes del rango, con su fila de totales.
 *
 * Tabla propia y no `SmartTable`: es un resumen de pocas filas con una fila de
 * totales al pie, no un listado para buscar y filtrar.
 */
export function TablaMeses({ datos }: { datos: ReporteVentasRango }) {
  const fila = (m: MesReporte) => {
    // Un mes sin ventas no tiene nada que costear: "—", no "Sin datos".
    const vacio = m.vendido === 0 && m.sin_costo === 0 && m.costo == null;
    const guion = <span className="text-muted-foreground/60">—</span>;
    return (
    <tr key={m.mes} className="border-t border-border">
      <td className={cn(fija, 'py-2 font-medium capitalize')}>{etiquetaMes(m.mes)}</td>
      <td className={celda}>{m.unidades}</td>
      <td className={celda}>{formatPrice(m.vendido)}</td>
      <td className={cn(celda, m.en_deuda > 0 ? 'text-amber-800' : 'text-muted-foreground')}>{formatPrice(m.en_deuda)}</td>
      <td className={celda}>{vacio ? guion : dineroOSinDatos(m.costo)}</td>
      <td className={celda}>{vacio ? guion : <Ganancia valor={m.ganancia} cobertura={m.cobertura_pct} />}</td>
      <td className={celda}>{vacio ? guion : margen(m.margen_pct)}</td>
      <td className={celda}>{formatPrice(m.invertido)}</td>
      <td className={cn(celda, m.perdidas > 0 ? 'text-destructive' : 'text-muted-foreground')}>{formatPrice(m.perdidas)}</td>
    </tr>
    );
  };

  const v = datos.ventas;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="max-h-[min(62svh,560px)] overflow-auto">
        <table className="w-full min-w-190 text-[13px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--color-border)]">
            <tr className="bg-secondary/60">
              <Th izq>Mes</Th><Th>Unidades</Th><Th>Vendido</Th><Th>En deuda</Th>
              <Th>Costo de lo vendido</Th><Th>Ganancia</Th><Th>Margen</Th>
              <Th>Invertido</Th><Th>Pérdidas</Th>
            </tr>
          </thead>
          <tbody>{datos.meses.map(fila)}</tbody>
          {datos.meses.length > 1 && (
            <tfoot className="sticky bottom-0 bg-card shadow-[inset_0_1px_0_var(--color-border)]">
              <tr className="bg-secondary/40 font-semibold">
                <td className={cn(fija, 'bg-[color-mix(in_oklab,var(--color-secondary)_40%,var(--color-card))] py-2.5')}>Total del rango</td>
                <td className={celda}>{v.unidades}</td>
                <td className={celda}>{formatPrice(v.vendido)}</td>
                <td className={celda}>{formatPrice(v.en_deuda)}</td>
                <td className={celda}>{dineroOSinDatos(v.costo)}</td>
                <td className={celda}><Ganancia valor={v.ganancia} cobertura={v.cobertura_pct} /></td>
                <td className={celda}>{margen(v.margen_pct)}</td>
                <td className={celda}>{formatPrice(datos.invertido.total)}</td>
                <td className={celda}>{formatPrice(datos.perdidas.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
