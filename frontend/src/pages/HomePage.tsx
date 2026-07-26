import { useSeo } from '../application/hooks/useSeo';
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PerfumeCard from '../components/PerfumeCard';
import ComboCard from '../components/ComboCard';
import CardSkeleton from '../components/CardSkeleton';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import AnunciosPopups from '../components/AnunciosPopups';
import ComoFunciona from '../components/ComoFunciona';
import GaleriaGanadores from '../components/recompensas/GaleriaGanadores';
import CatalogHeader from '../components/CatalogHeader';
import CatalogHero from '../components/catalog/CatalogHero';
import EmptyState from '../components/catalog/EmptyState';
import { Chip, FilterGroup } from '../components/catalog/FilterChips';
import { FilterSidebar, FilterToggleBar } from '../components/catalog/FilterSidebar';
import { CardCarousel, CarouselItem } from '../components/catalog/CardCarousel';
import { useCatalog } from '../application/hooks/useCatalog';
import { useDestacados } from '../application/hooks/useDestacados';
import { GENEROS, GENERO_LABELS } from '../domain/entities/perfume.schema';

interface Props {
  isAdmin?: boolean;
  adminPreview?: boolean;
}

interface SectionHeaderProps {
  title: string;
  to?: string;
  count?: number;
}

function SectionHeader({ title, to, count }: SectionHeaderProps) {
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

export default function HomePage({ isAdmin = false, adminPreview = false }: Props) {
  const navigate = useNavigate();
  const catalog = useCatalog();
  useSeo(
    'Celestial Parfums — Perfumería con esencias premium',
    'Perfumes para dama, caballero y unisex: contratipos, 1.1 y originales. Combos con descuento y pedidos por WhatsApp.',
  );
  const { nuevos, masVendidos } = useDestacados();
  // Con búsqueda o filtros activos las secciones destacadas se ocultan para no estorbar
  const mostrarDestacados = !catalog.loading && !catalog.search && !catalog.hasActiveFilters;

  useEffect(() => {
    if (isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, navigate]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {adminPreview && (
        <div className="flex items-center justify-between gap-3 bg-ink px-5 py-2.5 md:px-8">
          <span className="flex items-center gap-2 text-[13px] text-background/90">
            <Eye className="size-4" /> Vista previa del catálogo — modo administrador
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

      <CatalogHero
        title={
          <>
            Descubre tu <em className="italic text-primary">fragancia</em>
          </>
        }
        subtitle="Colección exclusiva de perfumes seleccionados para cada momento"
        searchValue={catalog.search}
        searchPlaceholder="Buscar perfume..."
        onSearchChange={catalog.onSearchChange}
      />

      <FilterToggleBar
        open={catalog.showFilters}
        hasActiveFilters={catalog.hasActiveFilters}
        onToggle={() => catalog.setShowFilters((v) => !v)}
        onClear={catalog.clearAll}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 pb-20 md:px-8 lg:flex-row">
        <FilterSidebar
          open={catalog.showFilters}
          hasActiveFilters={catalog.hasActiveFilters}
          onClear={catalog.clearAll}
        >
          <FilterGroup label="Género">
            {GENEROS.map((g) => (
              <Chip key={g} active={catalog.activeGenero === g} onClick={() => catalog.onGeneroToggle(g)}>
                {GENERO_LABELS[g]}
              </Chip>
            ))}
          </FilterGroup>

          {catalog.categorias.length > 0 && (
            <FilterGroup label="Categoría">
              {catalog.categorias.map((c) => (
                <Chip
                  key={c.id}
                  active={catalog.activeCategorias.has(c.nombre)}
                  onClick={() =>
                    catalog.toggleStringSet(c.nombre, catalog.activeCategorias, catalog.setActiveCategorias)
                  }
                >
                  {c.nombre}
                </Chip>
              ))}
            </FilterGroup>
          )}

          <FilterGroup label="Notas & Aromas">
            {catalog.allAromas.map((a) => (
              <Chip
                key={a}
                active={catalog.activeAromas.has(a)}
                onClick={() => catalog.toggleStringSet(a, catalog.activeAromas, catalog.setActiveAromas)}
              >
                {a}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Ocasiones">
            {catalog.allOcasiones.map((o) => (
              <Chip
                key={o}
                active={catalog.activeOcasiones.has(o)}
                onClick={() => catalog.toggleStringSet(o, catalog.activeOcasiones, catalog.setActiveOcasiones)}
              >
                {o}
              </Chip>
            ))}
          </FilterGroup>

          {catalog.comboCantidades.length > 0 && (
            <FilterGroup label="Combos">
              {catalog.comboCantidades.map((qty) => (
                <Chip
                  key={qty}
                  active={catalog.activeComboCantidades.has(qty)}
                  onClick={() => catalog.toggleComboCantidad(qty)}
                >
                  {qty} perfumes
                </Chip>
              ))}
            </FilterGroup>
          )}
        </FilterSidebar>

        <main className="min-w-0 flex-1">
          {catalog.error && <p className="py-6 text-center text-sm text-destructive">{catalog.error}</p>}

          {catalog.loading && (
            <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
              <CardSkeleton count={8} />
            </div>
          )}

          {!catalog.loading &&
            !catalog.error &&
            catalog.filteredCombos.length === 0 &&
            (!catalog.showPerfumes || catalog.totalPerfumes === 0) && <EmptyState />}

          {/* Nuevos lanzamientos (perfumes con menos de 1 mes en el catálogo) */}
          {mostrarDestacados && nuevos.length > 0 && (
            <section className="mb-12 animate-fade-up">
              <SectionHeader title="Nuevos lanzamientos" count={nuevos.length} />
              <CardCarousel>
                {nuevos.map((p) => (
                  <CarouselItem key={p.id}>
                    <PerfumeCard perfume={p} />
                  </CarouselItem>
                ))}
              </CardCarousel>
            </section>
          )}

          {/* Los mas vendidos (calculado automáticamente de las ventas) */}
          {mostrarDestacados && masVendidos.length > 0 && (
            <section className="mb-12 animate-fade-up">
              <SectionHeader title="Los mas vendidos" />
              <CardCarousel>
                {masVendidos.map((p) => (
                  <CarouselItem key={p.id}>
                    <PerfumeCard perfume={p} vendidos={p.unidades_vendidas} />
                  </CarouselItem>
                ))}
              </CardCarousel>
            </section>
          )}

          {/* Perfumes individuales */}
          {!catalog.loading && catalog.showPerfumes && catalog.totalPerfumes > 0 && (
            <section className="animate-fade-up">
              <SectionHeader
                title="Perfumes individuales"
                to={catalog.hasMorePerfumes ? '/perfumes' : undefined}
                count={catalog.totalPerfumes}
              />
              <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
                {catalog.previewPerfumes.map((p) => (
                  <PerfumeCard key={p.id} perfume={p} />
                ))}
              </div>
            </section>
          )}

          {/* Combos */}
          {!catalog.loading && catalog.filteredCombos.length > 0 && (
            <section className="mt-12 animate-fade-up">
              <SectionHeader
                title="Combos disponibles"
                to={catalog.hasMoreCombos ? '/combos' : undefined}
                count={catalog.filteredCombos.length}
              />
              <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
                {catalog.previewCombos.map((c) => (
                  <ComboCard key={c.id} combo={c} />
                ))}
              </div>
            </section>
          )}

          {mostrarDestacados && (
            <section className="mt-14 animate-fade-up">
              <GaleriaGanadores />
            </section>
          )}

          {!catalog.loading && <ComoFunciona />}
        </main>
      </div>

      <WhatsAppFab />
      <CartFab />
      {/* Ventanas emergentes configuradas por el admin (no en la vista previa) */}
      {!adminPreview && <AnunciosPopups />}
    </div>
  );
}
