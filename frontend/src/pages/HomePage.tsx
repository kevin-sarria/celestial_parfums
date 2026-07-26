import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PerfumeCard from '../components/PerfumeCard';
import ComboCard from '../components/ComboCard';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import AnunciosPopups from '../components/AnunciosPopups';
import ComoFunciona from '../components/ComoFunciona';
import EnvioPagos from '../components/EnvioPagos';
import CatalogHeader from '../components/CatalogHeader';
import LandingHero from '../components/catalog/LandingHero';
import GaleriaGanadores from '../components/recompensas/GaleriaGanadores';
import { CardCarousel, CarouselItem } from '../components/catalog/CardCarousel';
import { useDestacados } from '../application/hooks/useDestacados';
import { useSeo } from '../application/hooks/useSeo';
import { BASE_URL } from '../infrastructure/api/client';
import { fetchJsonCached } from '../infrastructure/api/cachedFetch';
import { WHATSAPP_NUMBER } from '../config/constants';
import type { Combo } from '../domain/entities/combo.schema';

interface Props {
  isAdmin?: boolean;
  adminPreview?: boolean;
}

const COMBOS_PREVIEW = 4;

function SectionHeader({ title, to, count }: { title: string; to?: string; count?: number }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="font-display text-[26px] font-light tracking-tight text-ink">{title}</h2>
      {to && (
        <Link
          to={to}
          className="group flex shrink-0 items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
        >
          Ver todos {count != null && `(${count})`}
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/**
 * Página de aterrizaje (landing): vende y da confianza. Muestra el buscador (que
 * lleva al catálogo), la franja de envíos/pagos, los destacados, combos, la
 * galería de ganadores y "cómo funciona". El catálogo completo con filtros vive
 * en /perfumes.
 */
export default function HomePage({ isAdmin = false, adminPreview = false }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [combos, setCombos] = useState<Combo[]>([]);
  const { nuevos, masVendidos } = useDestacados();
  useSeo(
    'Celestial Parfums — Perfumería con esencias premium',
    'Perfumes para dama, caballero y unisex: contratipos, 1.1 y originales. Combos con descuento y pedidos por WhatsApp.',
  );

  useEffect(() => {
    if (isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, navigate]);

  useEffect(() => {
    fetchJsonCached<{ data?: Combo[] }>(`${BASE_URL}/api/combos`)
      .then((json) => setCombos((json.data ?? []).filter((c) => c.activo)))
      .catch(() => {});
  }, []);

  const irAlCatalogo = () => {
    const q = search.trim();
    navigate(q ? `/perfumes?q=${encodeURIComponent(q)}` : '/perfumes');
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {adminPreview && (
        <div className="flex items-center justify-between gap-3 bg-ink px-5 py-2.5 md:px-8">
          <span className="flex items-center gap-2 text-[13px] text-background/90">
            <Eye className="size-4" /> Vista previa de la tienda — modo administrador
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full text-background hover:bg-background/15 hover:text-background"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="size-3.5" /> Volver al dashboard
          </Button>
        </div>
      )}

      <CatalogHeader isHome />

      <LandingHero
        search={search}
        onSearchChange={setSearch}
        onSubmit={irAlCatalogo}
        onVerCatalogo={irAlCatalogo}
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 md:px-8">
        {/* Barra de confianza anclada al hero (envíos · pago · asesoría) */}
        <EnvioPagos />

        {/* 1) Prueba social primero: lo que otros ya compran (efecto manada) */}
        {masVendidos.length > 0 && (
          <section className="mt-14 animate-fade-up">
            <SectionHeader title="Los más vendidos" to="/perfumes" />
            <CardCarousel>
              {masVendidos.map((p) => (
                <CarouselItem key={p.id}>
                  <PerfumeCard perfume={p} vendidos={p.unidades_vendidas} />
                </CarouselItem>
              ))}
            </CardCarousel>
          </section>
        )}

        {/* 2) Novedad: lo recién llegado */}
        {nuevos.length > 0 && (
          <section className="mt-20 animate-fade-up">
            <SectionHeader title="Nuevos lanzamientos" to="/perfumes" />
            <CardCarousel>
              {nuevos.map((p) => (
                <CarouselItem key={p.id}>
                  <PerfumeCard perfume={p} />
                </CarouselItem>
              ))}
            </CardCarousel>
          </section>
        )}

        {/* 3) Sube el ticket: combos con descuento */}
        {combos.length > 0 && (
          <section className="mt-20 animate-fade-up">
            <SectionHeader title="Combos con descuento" to="/combos" count={combos.length} />
            <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
              {combos.slice(0, COMBOS_PREVIEW).map((c) => (
                <ComboCard key={c.id} combo={c} />
              ))}
            </div>
          </section>
        )}

        {/* 4) Prueba social: clientes reales que ganaron premios (solo si hay) */}
        <GaleriaGanadores className="mt-20" />

        {/* 5) Reduce la incertidumbre del proceso */}
        <ComoFunciona />

        {/* 7) Cierre: empuja a la conversión real (WhatsApp), sin caja */}
        <section className="mt-20 border-t border-border/60 pt-16 text-center">
          <h2 className="mx-auto max-w-lg font-display text-3xl font-light leading-tight tracking-tight text-ink md:text-[2.5rem]">
            Tu próxima fragancia te espera
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
            ¿No sabes cuál elegir? Escríbenos por WhatsApp y te asesoramos.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="rounded-full px-8 shadow-[0_12px_30px_-14px] shadow-primary/50">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> Escríbenos por WhatsApp
              </a>
            </Button>
            <button
              type="button"
              onClick={irAlCatalogo}
              className="group inline-flex items-center gap-1 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              o ver el catálogo <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </section>
      </div>

      <WhatsAppFab />
      <CartFab />
      {/* Ventanas emergentes configuradas por el admin (no en la vista previa) */}
      {!adminPreview && <AnunciosPopups />}
    </div>
  );
}
