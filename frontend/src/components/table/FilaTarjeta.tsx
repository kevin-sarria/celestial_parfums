import { type ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnDef, RolMovil } from './tableTypes';

/** Valor pintado de una celda, con el mismo criterio que usa la tabla. */
function celda<T>(col: ColumnDef<T>, row: T): ReactNode {
  if (col.render) return col.render(row);
  return String(col.getValue(row) ?? '') || '—';
}

/**
 * Reparte las columnas según el papel que juegan en la tarjeta.
 * Si ninguna se declara `titulo`, manda la primera columna: así una tabla que
 * enciende la vista móvil sin marcar nada sigue siendo legible.
 */
function repartirColumnas<T>(columns: ColumnDef<T>[]) {
  const rol = (c: ColumnDef<T>): RolMovil => c.movil ?? 'detalle';
  const declarado = columns.find((c) => rol(c) === 'titulo');
  const titulo = declarado ?? columns[0];
  return {
    titulo,
    meta: columns.filter((c) => rol(c) === 'meta'),
    estado: columns.filter((c) => rol(c) === 'estado'),
    destacado: columns.filter((c) => rol(c) === 'destacado'),
    // Si el título salió por defecto, no repetirlo abajo en el detalle
    detalle: columns.filter((c) => rol(c) === 'detalle' && c !== titulo),
  };
}

interface FilaTarjetaProps<T> {
  row: T;
  /** Posición en la lista, o null si la tabla no está numerada. */
  numero: number | null;
  columns: ColumnDef<T>[];
  acciones?: ReactNode;
}

/**
 * Una fila de la tabla pintada como tarjeta táctil.
 *
 * Resumida por defecto (caben 5-6 en pantalla en vez de 2) y se expande al
 * tocarla. Se alimenta de los mismos `ColumnDef` que la tabla, así que las dos
 * vistas no se pueden desincronizar.
 */
export function FilaTarjeta<T>({ row, numero, columns, acciones }: FilaTarjetaProps<T>) {
  const [abierta, setAbierta] = useState(false);
  const { titulo, meta, estado, destacado, detalle } = repartirColumnas(columns);
  const hayMas = detalle.length > 0 || !!acciones;
  const hayCabecera = numero !== null || meta.length > 0 || estado.length > 0;

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full flex-col gap-1 p-3.5 text-left"
        onClick={() => hayMas && setAbierta((v) => !v)}
        aria-expanded={hayMas ? abierta : undefined}
      >
        {hayCabecera && (
          <span className="flex w-full items-start justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {numero !== null && `#${numero}`}
              {meta.map((c) => (
                <span key={c.key} className="ml-1.5 font-normal normal-case tracking-normal">
                  · {celda(c, row)}
                </span>
              ))}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {estado.map((c) => (
                <span key={c.key}>{celda(c, row)}</span>
              ))}
            </span>
          </span>
        )}

        <span className="text-[15px] font-medium text-foreground">{celda(titulo, row)}</span>

        {(destacado.length > 0 || hayMas) && (
          <span className="flex w-full items-end justify-between gap-3">
            <span className="font-display text-lg font-medium text-foreground">
              {destacado.map((c) => (
                <span key={c.key}>{celda(c, row)}</span>
              ))}
            </span>
            {hayMas && (
              <ChevronDown
                className={cn(
                  'size-5 shrink-0 text-muted-foreground transition-transform',
                  abierta && 'rotate-180',
                )}
              />
            )}
          </span>
        )}
      </button>

      {abierta && hayMas && (
        <div className="border-t border-border px-3.5 py-3">
          {detalle.length > 0 && (
            <dl className="space-y-1.5">
              {detalle.map((c) => (
                <div key={c.key} className="flex gap-3 text-[13px]">
                  <dt className="w-28 shrink-0 text-muted-foreground">{c.header}</dt>
                  <dd className="min-w-0 flex-1 text-foreground">{celda(c, row)}</dd>
                </div>
              ))}
            </dl>
          )}
          {acciones && (
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3 [&_button]:min-h-11">
              {acciones}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
