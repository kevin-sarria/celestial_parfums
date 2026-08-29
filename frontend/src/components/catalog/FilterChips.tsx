import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChipProps {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Se ve, pero no se puede elegir (una talla sin frascos armados). */
  disabled?: boolean;
  /** Explica por qué no se puede elegir. */
  title?: string;
}

/** Pastilla de filtro seleccionable. */
export function Chip({ active = false, onClick, children, disabled = false, title }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
        // Se enseña igual: saber qué tamaños existen es información, y esconderlos
        // haría creer que el perfume solo viene en uno.
        disabled && 'cursor-not-allowed opacity-45 line-through hover:border-border hover:text-muted-foreground',
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
