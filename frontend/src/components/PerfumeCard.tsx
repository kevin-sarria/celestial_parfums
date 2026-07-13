import { useNavigate } from 'react-router-dom';
import { Clock, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice, finalPrice } from '@/lib/format';
import type { Perfume } from '../domain/entities/perfume.schema';
import { GENERO_SYMBOLS } from '../domain/entities/perfume.schema';
import { toSlug } from '../utils/slug';

interface Props {
  perfume: Perfume;
}

const GENERO_BADGE_STYLES: Record<string, string> = {
  caballero: 'bg-sky-50 text-sky-600',
  dama: 'bg-rose-50 text-rose-500',
  unisex: 'bg-violet-50 text-violet-500',
};

export default function PerfumeCard({ perfume }: Props) {
  const navigate = useNavigate();
  const goToDetail = () => navigate(`/perfume/${toSlug(perfume.nombre)}`);
  const precioFinal = finalPrice(perfume.precio, perfume.descuento);

  return (
    <article
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_20px_45px_-20px_rgb(0_0_0/0.18)]',
        perfume.agotado && 'opacity-70',
      )}
      onClick={goToDetail}
      role="button"
      tabIndex={0}
      aria-label={`Ver perfume ${perfume.nombre}${perfume.agotado ? ' (Agotado)' : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && goToDetail()}
    >
      <div className="relative aspect-4/5 overflow-hidden bg-secondary">
        {perfume.imagen_url ? (
          <img
            src={perfume.imagen_url}
            alt={perfume.nombre}
            loading="lazy"
            className={cn(
              'h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]',
              perfume.agotado && 'grayscale',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-5xl italic text-muted-foreground/40">𝒫</span>
          </div>
        )}

        {perfume.genero && (
          <span
            className={cn(
              'absolute left-3 top-3 flex size-7 items-center justify-center rounded-full text-[13px] font-bold shadow-sm',
              GENERO_BADGE_STYLES[perfume.genero],
            )}
          >
            {GENERO_SYMBOLS[perfume.genero]}
          </span>
        )}

        {perfume.descuento > 0 && (
          <Badge className="absolute right-3 top-3 rounded-full bg-ink px-2.5 text-[11px] font-semibold text-background shadow-sm">
            -{perfume.descuento}%
          </Badge>
        )}

        {perfume.agotado && (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-background backdrop-blur-sm">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[17px] font-medium leading-snug text-ink">
            {perfume.nombre}
          </h3>
          {perfume.categoria && (
            <Badge variant="outline" className="shrink-0 rounded-full text-[10.5px] font-medium text-muted-foreground">
              {perfume.categoria}
            </Badge>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-primary">
            {formatPrice(precioFinal)}
          </span>
          {perfume.descuento > 0 && (
            <span className="text-[12.5px] text-muted-foreground line-through">
              {formatPrice(perfume.precio)}
            </span>
          )}
        </div>

        {perfume.descripcion && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {perfume.descripcion}
          </p>
        )}

        {perfume.tipos_aroma.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {perfume.tipos_aroma.map((a) => (
              <span
                key={a}
                className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-primary"
              >
                {a}
              </span>
            ))}
          </div>
        )}

        {perfume.ocasiones.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {perfume.ocasiones.map((o) => (
              <span
                key={o}
                className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {o}
              </span>
            ))}
          </div>
        )}

        {(perfume.duracion || perfume.proyeccion) && (
          <div className="mt-auto flex items-center gap-4 border-t border-border/70 pt-2.5 text-[12px] text-muted-foreground">
            {perfume.duracion && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" /> {perfume.duracion}
              </span>
            )}
            {perfume.proyeccion && (
              <span className="flex items-center gap-1.5">
                <Wind className="size-3.5" /> {perfume.proyeccion}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
