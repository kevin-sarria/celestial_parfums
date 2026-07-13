import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
}

/** Estado vacío de resultados en el catálogo. */
export default function EmptyState({ message = 'Sin resultados para los filtros aplicados' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <SearchX className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
