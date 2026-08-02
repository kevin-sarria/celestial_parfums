import type { ReactNode } from 'react';

export type ColType = 'string' | 'number' | 'currency' | 'date' | 'enum';
export type SortDir = 'asc' | 'desc';

/** Qué papel juega la columna cuando la fila se pinta como tarjeta en celular. */
export type RolMovil = 'titulo' | 'meta' | 'estado' | 'destacado' | 'detalle';

export interface ColumnDef<T> {
  key: string;
  header: string;
  type: ColType;
  getValue: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  enumOptions?: readonly string[];
  className?: string;
  noTruncate?: boolean;
  /** Papel en la tarjeta de celular. Sin marcar = 'detalle' (solo al expandir). */
  movil?: RolMovil;
}

export interface SortState {
  key: string;
  dir: SortDir;
}

export type StringOp = 'contains' | 'equals' | 'starts';
export type NumberOp = 'eq' | 'gt' | 'lt';
export type DateOp = 'eq' | 'before' | 'after';

export type FilterValue =
  | { type: 'string'; op: StringOp; value: string }
  | { type: 'number'; op: NumberOp; value: string }
  | { type: 'currency'; op: NumberOp; value: string }
  | { type: 'date'; op: DateOp; value: string }
  | { type: 'enum'; values: string[] };

export type FiltersState = Record<string, FilterValue>;
