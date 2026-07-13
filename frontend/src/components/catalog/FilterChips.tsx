import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChipProps {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Pastilla de filtro seleccionable. */
export function Chip({ active = false, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

interface FilterGroupProps {
  label: string;
  children: ReactNode;
}

/** Grupo de filtros con etiqueta editorial en mayúsculas espaciadas. */
export function FilterGroup({ label, children }: FilterGroupProps) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
