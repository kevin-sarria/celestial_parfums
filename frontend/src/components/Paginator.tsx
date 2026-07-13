import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
  className?: string;
}

export default function Paginator({ page, total, pageSize, onChange, className }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (page >= totalPages - 3)
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  const btnBase =
    'flex size-9 items-center justify-center rounded-full text-[13.5px] font-medium transition-colors duration-200 disabled:opacity-35';

  return (
    <div className={cn('mt-10 flex items-center justify-center gap-1.5', className)}>
      <button
        className={cn(btnBase, 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="size-4" />
      </button>

      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            className={cn(
              btnBase,
              p === page
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
            onClick={() => onChange(p as number)}
          >
            {p}
          </button>
        ),
      )}

      <button
        className={cn(btnBase, 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Página siguiente"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
