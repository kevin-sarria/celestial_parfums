import type { ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterToggleBarProps {
  open: boolean;
  hasActiveFilters: boolean;
  onToggle: () => void;
  onClear: () => void;
}

/** Barra móvil para mostrar/ocultar los filtros (oculta en escritorio). */
export function FilterToggleBar({ open, hasActiveFilters, onToggle, onClear }: FilterToggleBarProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-5 pb-4 md:px-8 lg:hidden">
      <Button
        variant={open ? 'secondary' : 'outline'}
        size="sm"
        className="rounded-full"
        onClick={onToggle}
      >
        <SlidersHorizontal className="size-3.5" />
        Filtros
        {hasActiveFilters && <span className="ml-0.5 size-1.5 rounded-full bg-primary" />}
      </Button>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={onClear}>
          <X className="size-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  );
}

interface FilterSidebarProps {
  open: boolean;
  hasActiveFilters: boolean;
  onClear: () => void;
  children: ReactNode;
}

/** Sidebar de filtros del catálogo: siempre visible en escritorio, colapsable en móvil. */
export function FilterSidebar({ open, hasActiveFilters, onClear, children }: FilterSidebarProps) {
  return (
    <aside
      className={cn(
        'w-full shrink-0 space-y-6 lg:block lg:w-60',
        open ? 'block animate-fade-up' : 'hidden',
      )}
    >
      {children}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="hidden rounded-full text-muted-foreground lg:inline-flex"
          onClick={onClear}
        >
          <X className="size-3.5" />
          Limpiar filtros
        </Button>
      )}
    </aside>
  );
}
