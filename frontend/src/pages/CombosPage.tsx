import { useSeo } from '../application/hooks/useSeo';
import Paginator from '../components/Paginator';
import ComboCard from '../components/ComboCard';
import CardSkeleton from '../components/CardSkeleton';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import CatalogHeader from '../components/CatalogHeader';
import CatalogHero from '../components/catalog/CatalogHero';
import EmptyState from '../components/catalog/EmptyState';
import { Chip } from '../components/catalog/FilterChips';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useCombos, COMBOS_PAGE_SIZE } from '../application/hooks/useCombos';

export default function CombosPage() {
  const catalog = useCombos();
  useSeo('Combos de perfumes', 'Combos de 2, 3 y más perfumes con precio especial. Arma el tuyo y pide por WhatsApp.');

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <CatalogHero
        title="Combos disponibles"
        subtitle={
          catalog.loading
            ? ''
            : `${catalog.filtered.length} ${catalog.filtered.length === 1 ? 'combo disponible' : 'combos disponibles'}`
        }
        searchValue={catalog.search}
        searchPlaceholder="Buscar combo..."
        onSearchChange={catalog.onSearchChange}
      />

      {catalog.comboCantidades.length > 0 && (
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-5 pb-6 md:px-8">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Cantidad
          </span>
          {catalog.comboCantidades.map((qty) => (
            <Chip
              key={qty}
              active={catalog.activeComboCantidades.has(qty)}
              onClick={() => catalog.toggleComboCantidad(qty)}
            >
              {qty} perfumes
            </Chip>
          ))}
          {catalog.hasActiveFilters && (
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={catalog.clearAll}>
              <X className="size-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 md:px-8">
        {catalog.error && <p className="py-6 text-center text-sm text-destructive">{catalog.error}</p>}

        {!catalog.loading && !catalog.error && catalog.filtered.length === 0 && <EmptyState />}

        <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
          {catalog.loading ? (
            <CardSkeleton count={6} />
          ) : (
            catalog.paginated.map((c) => <ComboCard key={c.id} combo={c} />)
          )}
        </div>

        <Paginator
          page={catalog.page}
          total={catalog.filtered.length}
          pageSize={COMBOS_PAGE_SIZE}
          onChange={(p) => {
            catalog.setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </main>

      <WhatsAppFab />
      <CartFab />
    </div>
  );
}
