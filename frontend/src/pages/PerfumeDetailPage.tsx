import { useSeo } from '../application/hooks/useSeo';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, ShoppingCart, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice, finalPrice } from '@/lib/format';
import PerfumeCard from '../components/PerfumeCard';
import { CardCarousel, CarouselItem } from '../components/catalog/CardCarousel';
import PerfumeSpinner from '../components/PerfumeSpinner';
import AddToCartModal from '../components/AddToCartModal';
import CartFab from '../components/CartFab';
import CatalogHeader from '../components/CatalogHeader';
import { usePerfumeDetail } from '../application/hooks/usePerfumeDetail';
import { GENERO_LABELS } from '../domain/entities/perfume.schema';
import { aromaColor } from '../domain/entities/aroma.colors';

const GENERO_PILL_STYLES: Record<string, string> = {
  caballero: 'border-sky-200 bg-sky-50 text-sky-600',
  dama: 'border-rose-200 bg-rose-50 text-rose-500',
  unisex: 'border-violet-200 bg-violet-50 text-violet-500',
};

export default function PerfumeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { perfume, related, loading, error } = usePerfumeDetail(slug);
  const [cartModal, setCartModal] = useState(false);
  useSeo(perfume?.nombre, perfume?.descripcion ?? undefined);

  const precioFinal = perfume ? finalPrice(perfume.precio, perfume.descuento) : 0;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <div className="mx-auto w-full max-w-6xl px-5 pt-6 md:px-8">
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Volver
        </Button>
      </div>

      {loading && <PerfumeSpinner />}

      {!loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="rounded-full" onClick={() => navigate('/perfumes')}>
            Ver todos los perfumes
          </Button>
        </div>
      )}

      {!loading && perfume && (
        <>
          <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-28 pt-6 md:px-8 md:pb-16 lg:grid-cols-2 lg:gap-14 animate-fade-up">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-secondary">
              {perfume.imagen_url ? (
                <img
                  src={perfume.imagen_url}
                  alt={perfume.nombre}
                  className="aspect-4/5 h-full w-full object-cover"
                />
              ) : (
                <div className="flex aspect-4/5 items-center justify-center">
                  <span className="font-display text-7xl italic text-muted-foreground/40">𝒫</span>
                </div>
              )}
              {perfume.descuento > 0 && (
                <Badge className="absolute right-4 top-4 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-background shadow-sm">
                  -{perfume.descuento}%
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                {perfume.genero && (
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1 text-[12px] font-semibold',
                      GENERO_PILL_STYLES[perfume.genero],
                    )}
                  >
                    {GENERO_LABELS[perfume.genero]}
                  </span>
                )}
                {perfume.categoria && (
                  <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                    {perfume.categoria}
                  </Badge>
                )}
              </div>

              <h1 className="font-display text-4xl font-light tracking-tight text-ink md:text-5xl">
                {perfume.nombre}
              </h1>

              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-medium text-primary">
                  {formatPrice(precioFinal)}
                </span>
                {perfume.descuento > 0 && (
                  <span className="text-base text-muted-foreground line-through">
                    {formatPrice(perfume.precio)}
                  </span>
                )}
              </div>

              {perfume.descripcion && (
                <p className="max-w-prose text-[15px] leading-relaxed text-muted-foreground">
                  {perfume.descripcion}
                </p>
              )}

              {perfume.tipos_aroma.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Notas & Aromas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {perfume.tipos_aroma.map((a) => {
                      const c = aromaColor(a);
                      return (
                        <span
                          key={a}
                          className="rounded-full px-3 py-1 text-[12px] font-medium"
                          style={{ backgroundColor: c.bg, color: c.fg }}
                        >
                          {a}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {perfume.ocasiones.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Ocasiones
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {perfume.ocasiones.map((o) => (
                      <span key={o} className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(perfume.duracion || perfume.proyeccion) && (
                <div className="flex items-center gap-6 border-t border-border/70 pt-4 text-[13px] text-muted-foreground">
                  {perfume.duracion && (
                    <span className="flex items-center gap-2">
                      <Clock className="size-4" /> {perfume.duracion}
                    </span>
                  )}
                  {perfume.proyeccion && (
                    <span className="flex items-center gap-2">
                      <Wind className="size-4" /> {perfume.proyeccion}
                    </span>
                  )}
                </div>
              )}

              {!perfume.agotado && (
                <Button
                  size="lg"
                  className="mt-2 h-12 w-fit rounded-full px-8 text-[14px] shadow-[0_12px_30px_-12px] shadow-primary/50 transition-all duration-300 hover:shadow-[0_16px_36px_-12px] hover:shadow-primary/60"
                  onClick={() => setCartModal(true)}
                >
                  <ShoppingCart className="size-4" />
                  Agregar al carrito
                </Button>
              )}
            </div>
          </main>

          {related.length > 0 && (
            <section className="border-t border-border/70 bg-secondary/40 py-14">
              <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
                <h2 className="mb-6 font-display text-[26px] font-light tracking-tight text-ink">
                  También te puede interesar
                </h2>
                <CardCarousel>
                  {related.map((p) => (
                    <CarouselItem key={p.id}>
                      <PerfumeCard perfume={p} />
                    </CarouselItem>
                  ))}
                </CardCarousel>
              </div>
            </section>
          )}
        </>
      )}

      {/* Barra de compra fija en móvil: el CTA siempre a un toque de distancia */}
      {perfume && !perfume.agotado && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-sm md:hidden">
          <div className="min-w-0">
            <p className="truncate text-[12px] text-muted-foreground">{perfume.nombre}</p>
            <p className="text-[15px] font-semibold text-primary">
              {formatPrice(precioFinal)}
              {perfume.descuento > 0 && (
                <span className="ml-2 text-[11.5px] font-normal text-muted-foreground line-through">
                  {formatPrice(perfume.precio)}
                </span>
              )}
            </p>
          </div>
          <Button className="h-10 shrink-0 rounded-full px-5" onClick={() => setCartModal(true)}>
            <ShoppingCart className="size-4" /> Agregar
          </Button>
        </div>
      )}

      <CartFab />

      {perfume && (
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
      )}
    </div>
  );
}
