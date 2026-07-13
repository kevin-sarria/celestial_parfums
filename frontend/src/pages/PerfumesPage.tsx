import PerfumeCard from '../components/PerfumeCard';
import CardSkeleton from '../components/CardSkeleton';
import Paginator from '../components/Paginator';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import CatalogHeader from '../components/CatalogHeader';
import CatalogHero from '../components/catalog/CatalogHero';
import EmptyState from '../components/catalog/EmptyState';
import { Chip, FilterGroup } from '../components/catalog/FilterChips';
import { FilterSidebar, FilterToggleBar } from '../components/catalog/FilterSidebar';
import { usePerfumes, PERFUMES_PAGE_SIZE } from '../application/hooks/usePerfumes';
import { GENEROS, GENERO_LABELS } from '../domain/entities/perfume.schema';

export default function PerfumesPage() {
  const catalog = usePerfumes();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <CatalogHero
        title="Perfumes individuales"
        subtitle={
          catalog.loading
            ? ''
            : `${catalog.filtered.length} ${catalog.filtered.length === 1 ? 'perfume' : 'perfumes'} disponibles`
        }
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
        </FilterSidebar>

        <main className="min-w-0 flex-1">
          {catalog.error && <p className="py-6 text-center text-sm text-destructive">{catalog.error}</p>}

          {!catalog.loading && !catalog.error && catalog.filtered.length === 0 && <EmptyState />}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.loading ? (
              <CardSkeleton count={8} />
            ) : (
              catalog.paginated.map((p) => <PerfumeCard key={p.id} perfume={p} />)
            )}
          </div>

          <Paginator
            page={catalog.page}
            total={catalog.filtered.length}
            pageSize={PERFUMES_PAGE_SIZE}
            onChange={(p) => {
              catalog.setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </main>
      </div>

      <WhatsAppFab />
      <CartFab />
    </div>
  );
}
