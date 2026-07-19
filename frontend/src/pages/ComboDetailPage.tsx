import { useSeo } from '../application/hooks/useSeo';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPrice, finalPrice } from '@/lib/format';
import ComboCard from '../components/ComboCard';
import { CardCarousel, CarouselItem } from '../components/catalog/CardCarousel';
import PerfumeSpinner from '../components/PerfumeSpinner';
import AddToCartModal from '../components/AddToCartModal';
import CartFab from '../components/CartFab';
import CatalogHeader from '../components/CatalogHeader';
import { useComboDetail } from '../application/hooks/useComboDetail';

export default function ComboDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { combo, related, loading, error } = useComboDetail(slug);
  const [cartModal, setCartModal] = useState(false);
  useSeo(combo?.nombre, combo?.descripcion ?? undefined);

  const precioFinal = combo ? finalPrice(combo.precio, combo.descuento) : 0;

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
          <Button variant="outline" className="rounded-full" onClick={() => navigate('/combos')}>
            Ver todos los combos
          </Button>
        </div>
      )}

      {!loading && combo && (
        <>
          <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-6 md:px-8 lg:grid-cols-2 lg:gap-14 animate-fade-up">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-secondary">
              {combo.imagen_url ? (
                <img src={combo.imagen_url} alt={combo.nombre} className="aspect-4/5 h-full w-full object-cover" />
              ) : (
                <div className="flex aspect-4/5 items-center justify-center">
                  <span className="text-7xl">ð</span>
                </div>
              )}
              {combo.descuento > 0 && (
                <Badge className="absolute right-4 top-4 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-background shadow-sm">
                  -{combo.descuento}%
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-[12px] font-semibold text-primary">
                  {combo.cantidad} perfumes
                </Badge>
                {combo.categoria && (
                  <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                    {combo.categoria}
                  </Badge>
                )}
              </div>

              <h1 className="font-display text-4xl font-light tracking-tight text-ink md:text-5xl">
                {combo.nombre}
              </h1>

              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-medium text-primary">{formatPrice(precioFinal)}</span>
                {combo.descuento > 0 && (
                  <span className="text-base text-muted-foreground line-through">{formatPrice(combo.precio)}</span>
                )}
              </div>

              {combo.descripcion && (
                <p className="max-w-prose text-[15px] leading-relaxed text-muted-foreground">{combo.descripcion}</p>
              )}

              <Button
                size="lg"
                className="mt-2 h-12 w-fit rounded-full px-8 text-[14px] shadow-[0_12px_30px_-12px] shadow-primary/50 transition-all duration-300 hover:shadow-[0_16px_36px_-12px] hover:shadow-primary/60"
                onClick={() => setCartModal(true)}
              >
                <ShoppingCart className="size-4" />
                Agregar al carrito
              </Button>
            </div>
          </main>

          {related.length > 0 && (
            <section className="border-t border-border/70 bg-secondary/40 py-14">
              <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
                <h2 className="mb-6 font-display text-[26px] font-light tracking-tight text-ink">
                  Otros combos disponibles
                </h2>
                <CardCarousel>
                  {related.map((c) => (
                    <CarouselItem key={c.id} className="w-72 sm:w-80">
                      <ComboCard combo={c} />
                    </CarouselItem>
                  ))}
                </CardCarousel>
              </div>
            </section>
          )}
        </>
      )}

      <CartFab />

      {combo && (
        <AddToCartModal
          open={cartModal}
          onClose={() => setCartModal(false)}
          producto={{
            id: combo.id,
            nombre: combo.nombre,
            precio: precioFinal,
            descuento: combo.descuento,
            imagen_url: combo.imagen_url,
            esCombo: true,
            categoria: combo.categoria,
            genero: null,
            presentaciones: [],
          }}
        />
      )}
    </div>
  );
}
