import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { fechaLegible } from '@/utils/calendario';
import type { EsenciaPorAcabarse, Frasco11, Pendiente, TonoPendiente, VentaReciente } from './tipos';

/**
 * Los cuatro bloques de Inicio. Cada uno es CORTO a propósito (un tope de
 * filas) y termina en un enlace a la pantalla que tiene el detalle: Inicio
 * dice qué mirar, no repite la pantalla entera (la lección de la banda de 55
 * renglones de Inventario, ver `arquitectura.md`).
 */

/** Tarjeta con título, un enlace "Ver…" arriba a la derecha y su contenido. */
export function PanelInicio({ titulo, detalle, enlace, children }: {
  titulo: string;
  /** Una línea gris bajo el título. */
  detalle?: string;
  enlace?: { a: string; texto: string };
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-medium text-foreground">{titulo}</h2>
          {detalle && <p className="text-[12.5px] text-muted-foreground">{detalle}</p>}
        </div>
        {enlace && (
          <Link to={enlace.a} className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium text-primary hover:underline">
            {enlace.texto} <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Lo que se muestra cuando un bloque no tiene nada que decir: en verde, es una buena noticia. */
function TodoBien({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700">
      <CircleCheck className="size-4 shrink-0" /> {children}
    </p>
  );
}

const PUNTO: Record<TonoPendiente, string> = {
  urgente: 'bg-rose-500',
  aviso: 'bg-amber-500',
  info: 'bg-sky-500',
};

/** Los pendientes de la campana, cada uno con su enlace a donde se resuelve. */
export function ListaPendientes({ pendientes }: { pendientes: Pendiente[] }) {
  if (pendientes.length === 0) return <TodoBien>Nada pendiente por ahora.</TodoBien>;
  return (
    <ul className="-mx-1 flex flex-col">
      {pendientes.map(p => {
        const contenido = (
          <>
            <span aria-hidden className={cn('size-2 shrink-0 rounded-full', PUNTO[p.tono])} />
            <span className="flex-1 text-[13.5px] text-foreground">{p.texto}</span>
            {p.tab && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          </>
        );
        const clase = 'flex items-center gap-3 rounded-lg px-2 py-2';
        return (
          <li key={p.id}>
            {p.tab
              ? <Link to={`/dashboard/${p.tab}`} className={cn(clase, 'hover:bg-secondary')}>{contenido}</Link>
              : <div className={clase}>{contenido}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export function UltimasVentas({ ventas }: { ventas: VentaReciente[] }) {
  if (ventas.length === 0) return <p className="text-[13px] text-muted-foreground">Todavía no hay ventas.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {ventas.map(v => (
        <li key={v.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-foreground">{v.persona}</p>
            <p className="truncate text-[12px] text-muted-foreground">
              {fechaLegible(v.dia.slice(0, 10))} · {v.referencia_perfume}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[13.5px] font-semibold tabular-nums text-foreground">{formatPrice(v.valor_venta)}</p>
            {!v.pagada && <p className="text-[11.5px] font-medium text-amber-600">Por cobrar</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tope de filas de los bloques de listas: lo demás está en su pantalla. */
const TOPE = 6;

export function Frascos11SinArmar({ filas, dias }: { filas: Frasco11[]; dias: number }) {
  if (filas.length === 0) return <TodoBien>Todos los 1.1 de la tienda tienen frascos armados.</TodoBien>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {filas.slice(0, TOPE).map(f => (
        <li key={f.perfume_id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="min-w-0 truncate text-[13.5px] text-foreground">{f.nombre}</span>
          <span className={cn('shrink-0 text-[12.5px] tabular-nums', f.vendidos > 0 ? 'font-medium text-amber-700' : 'text-muted-foreground')}>
            {f.vendidos > 0 ? `${f.vendidos} ${f.vendidos === 1 ? 'vendido' : 'vendidos'} en ${dias} días` : 'sin ventas recientes'}
          </span>
        </li>
      ))}
      {filas.length > TOPE && (
        <li className="pt-2 text-[12.5px] text-muted-foreground">y {filas.length - TOPE} más</li>
      )}
    </ul>
  );
}

const cuantoDura = (e: EsenciaPorAcabarse) => {
  if (e.stock <= 0) return 'Se acabó';
  if (e.dias_restantes == null) return 'Sin consumo reciente';
  if (e.dias_restantes === 0) return 'Se acaba hoy';
  return `≈ ${e.dias_restantes} ${e.dias_restantes === 1 ? 'día' : 'días'}`;
};

export function EsenciasPorAcabarse({ filas }: { filas: EsenciaPorAcabarse[] }) {
  if (filas.length === 0) return <TodoBien>Ninguna esencia está en su mínimo.</TodoBien>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {filas.map(e => (
        <li key={e.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] text-foreground">{e.nombre}</p>
            <p className="text-[12px] tabular-nums text-muted-foreground">
              Quedan {e.stock.toLocaleString('es-CO')} {e.unidad}
            </p>
          </div>
          <span className={cn(
            'shrink-0 text-[12.5px] font-medium',
            e.stock <= 0 || e.dias_restantes === 0 ? 'text-rose-600' : 'text-amber-700',
          )}>
            {cuantoDura(e)}
          </span>
        </li>
      ))}
    </ul>
  );
}
