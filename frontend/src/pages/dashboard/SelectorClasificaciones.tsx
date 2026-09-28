import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CLASIFICACIONES, TAB_META } from './navegacion';
import type { Tab } from './types';

/**
 * Las pestañas de arriba de las cinco clasificaciones (aromas, ocasiones,
 * categorías, presentaciones y gamas): en el menú son una sola entrada y aquí
 * se pasa de una a otra (2026-09-28). Enlaces y no estado: cada lista sigue
 * teniendo su dirección propia.
 */
export function SelectorClasificaciones({ actual }: { actual: Tab }) {
  return (
    <nav aria-label="Clasificaciones" className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:justify-center">
      {CLASIFICACIONES.map(t => {
        const { label, icon: Icon } = TAB_META[t];
        const activa = t === actual;
        return (
          <Link
            key={t}
            to={`/dashboard/${t}`}
            aria-current={activa ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              activa ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-secondary',
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
