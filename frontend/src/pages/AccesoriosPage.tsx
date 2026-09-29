import { useSeo } from '../application/hooks/useSeo';
import PerfumeCard from '../components/PerfumeCard';
import CardSkeleton from '../components/CardSkeleton';
import Paginator from '../components/Paginator';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import CatalogHeader from '../components/CatalogHeader';
import CatalogHero from '../components/catalog/CatalogHero';
import { ACCESORIOS_PAGE_SIZE, useAccesorios } from '../application/hooks/useAccesorios';

/**
 * /accesorios: el perfumero, la bolsa, la tarjeta (2026-09-28, Ola 3 del
 * diseño de Productos y Accesorios). Salen de `/perfumes`, que vuelve a ser
 * solo fragancias —los 1.1 siguen allá: son perfume—.
 *
 * Sin filtros de género ni de notas: en un accesorio no significan nada.
 * Título y descripción propios (una página nueva sin ellos no la encuentra
 * Google).
 */
export default function AccesoriosPage() {
  const c = useAccesorios();
  useSeo(
    'Accesorios',
    'Accesorios para tu perfume: perfumeros recargables para llevarlo contigo, bolsas y detalles para regalar.',
  );

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <CatalogHero
        title="Accesorios"
        subtitle={c.loading ? '' : `${c.total} ${c.total === 1 ? 'accesorio disponible' : 'accesorios disponibles'}`}
        searchValue={c.search}
        searchPlaceholder="Buscar accesorio..."
        onSearchChange={c.onSearchChange}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 md:px-8">
        {c.error && <p className="py-6 text-center text-sm text-destructive">{c.error}</p>}

        {!c.loading && !c.error && c.total === 0 && (
          <p className="py-16 text-center text-[15px] text-muted-foreground">
            {c.search.trim() ? 'No encontramos un accesorio con ese nombre.' : 'Pronto tendremos accesorios aquí.'}
          </p>
        )}

        <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
          {c.loading ? <CardSkeleton count={4} /> : c.items.map((p) => <PerfumeCard key={p.id} perfume={p} />)}
        </div>

        <Paginator
          page={c.page}
          total={c.total}
          pageSize={ACCESORIOS_PAGE_SIZE}
          onChange={(p) => { c.setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      </main>

      <WhatsAppFab />
      <CartFab />
    </div>
  );
}
