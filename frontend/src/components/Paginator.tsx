interface Props {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
  className?: string;
}

export default function Paginator({ page, total, pageSize, onChange, className = 'catalog-pagination' }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  return (
    <div className={className}>
      <button
        className="pg-btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Página anterior"
      >
        ‹
      </button>

      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="pg-ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`pg-btn ${p === page ? 'pg-btn--active' : ''}`}
            onClick={() => onChange(p as number)}
          >
            {p}
          </button>
        )
      )}

      <button
        className="pg-btn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Página siguiente"
      >
        ›
      </button>
    </div>
  );
}
