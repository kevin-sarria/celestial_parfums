import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice, finalPrice } from '@/lib/format';
import type { Combo } from '../domain/entities/combo.schema';
import { toSlug } from '../utils/slug';

interface Props {
  combo: Combo;
}

export default function ComboCard({ combo: c }: Props) {
  const navigate = useNavigate();
  const goToDetail = () => navigate(`/combo/${toSlug(c.nombre)}`);
  const precioFinal = finalPrice(c.precio, c.descuento);

  return (
    <article
      className={cn(
        // h-full: todas las cards de una fila comparten la misma altura
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_20px_45px_-20px_rgb(0_0_0/0.18)]',
      )}
      onClick={goToDetail}
      role="button"
      tabIndex={0}
      aria-label={`Ver combo ${c.nombre} - ${c.cantidad} perfumes`}
      onKeyDown={(e) => e.key === 'Enter' && goToDetail()}
    >
      {/* Imagen siempre presente (con placeholder) para que las cards no varíen de altura */}
      <div className="relative h-40 shrink-0 overflow-hidden bg-white p-3">
        {c.imagen_url ? (
          <img
            src={c.imagen_url}
            alt={c.nombre}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl opacity-40">🎁</span>
          </div>
        )}
        {c.descuento > 0 && (
          <Badge className="absolute right-3 top-3 rounded-full bg-ink px-2.5 text-[11px] font-semibold text-background shadow-sm">
            -{c.descuento}%
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex min-h-11 items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-[17px] font-medium leading-snug text-ink">{c.nombre}</h3>
          <Badge variant="secondary" className="shrink-0 rounded-full text-[11px] font-semibold text-primary">
            {c.cantidad} perfumes
          </Badge>
        </div>

        {c.categoria && (
          <Badge variant="outline" className="w-fit max-w-full rounded-full text-[10.5px] font-medium text-muted-foreground">
            <span className="truncate">{c.categoria}</span>
          </Badge>
        )}

        <p className="line-clamp-2 min-h-9.75 text-[13px] leading-relaxed text-muted-foreground">
          {c.descripcion}
        </p>

        <div className="mt-auto flex items-baseline gap-2 border-t border-border/70 pt-3">
          <span className="text-[16px] font-semibold tracking-tight text-primary">
            {formatPrice(precioFinal)}
          </span>
          {c.descuento > 0 && (
            <span className="text-[12.5px] text-muted-foreground line-through">{formatPrice(c.precio)}</span>
          )}
        </div>
      </div>
    </article>
  );
}
