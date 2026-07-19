import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ShoppingCart, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice, finalPrice } from '@/lib/format';
import AddToCartModal from './AddToCartModal';
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
  const [cartModal, setCartModal] = useState(false);
  const goToDetail = () => navigate(`/perfume/${toSlug(perfume.nombre)}`);
  const precioFinal = finalPrice(perfume.precio, perfume.descuento);

  return (
    <>
    <article
      className={cn(
        // h-full: todas las cards de una fila comparten la misma altura
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_20px_45px_-20px_rgb(0_0_0/0.18)]',
        perfume.agotado && 'opacity-70',
      )}
      onClick={goToDetail}
      role="button"
      tabIndex={0}
      aria-label={`Ver perfume ${perfume.nombre}${perfume.agotado ? ' (Agotado)' : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && goToDetail()}
    >
      {/* object-contain sobre fondo blanco: muestra el frasco completo sin recortes */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-white p-3">
        {perfume.imagen_url ? (
          <img
            src={perfume.imagen_url}
            alt={perfume.nombre}
            loading="lazy"
            className={cn(
              'h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.04]',
              perfume.agotado && 'grayscale',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-5xl italic text-muted-foreground/40">𝒫</span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {perfume.genero && (
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-[13px] font-bold shadow-sm',
                GENERO_BADGE_STYLES[perfume.genero],
              )}
            >
              {GENERO_SYMBOLS[perfume.genero]}
            </span>
          )}
          {perfume.es_nuevo && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
              Nuevo
            </span>
          )}
        </div>

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

        {!perfume.agotado && (
          <button
            type="button"
            className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-10px] shadow-primary/60 transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label={`Agregar ${perfume.nombre} al carrito`}
            onClick={(e) => {
              e.stopPropagation();
              setCartModal(true);
            }}
          >
            <ShoppingCart className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Zonas con altura reservada para que todas las cards queden alineadas */}
        <div className="flex min-h-11 items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-[17px] font-medium leading-snug text-ink">
            {perfume.nombre}
          </h3>
          {perfume.categoria && (
            <Badge variant="outline" className="max-w-24 shrink-0 rounded-full text-[10.5px] font-medium text-muted-foreground">
              <span className="truncate">{perfume.categoria}</span>
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

        <p className="line-clamp-2 min-h-9.75 text-[13px] leading-relaxed text-muted-foreground">
          {perfume.descripcion}
        </p>

        <div className="flex h-5.75 gap-1.5 overflow-hidden">
          {perfume.tipos_aroma.slice(0, 3).map((a) => (
            <span
              key={a}
              className="whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-primary"
            >
              {a}
            </span>
          ))}
          {perfume.tipos_aroma.length > 3 && (
            <span className="whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-primary">
              +{perfume.tipos_aroma.length - 3}
            </span>
          )}
        </div>

        <div className="flex h-5.75 gap-1.5 overflow-hidden">
          {perfume.ocasiones.slice(0, 3).map((o) => (
            <span
              key={o}
              className="whitespace-nowrap rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {o}
            </span>
          ))}
          {perfume.ocasiones.length > 3 && (
            <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              +{perfume.ocasiones.length - 3}
            </span>
          )}
        </div>

        <div className="mt-auto flex min-h-8.25 items-center gap-4 border-t border-border/70 pt-2.5 text-[12px] text-muted-foreground">
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
      </div>
    </article>

    {/* Fuera del <article> para que los clics dentro del modal no naveguen al detalle */}
    <AddToCartModal
      open={cartModal}
      onClose={() => setCartModal(false)}
      producto={{
        id: perfume.id,
        nombre: perfume.nombre,
        precio: precioFinal,
        descuento: perfume.descuento,
        imagen_url: perfume.imagen_url,
        esCombo: false,
        categoria: perfume.categoria,
        genero: perfume.genero,
        presentaciones: perfume.presentaciones,
      }}
    />
    </>
  );
}
