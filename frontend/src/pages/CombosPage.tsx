import { useNavigate } from 'react-router-dom';
import Paginator from '../components/Paginator';
import ComboCard from '../components/ComboCard';
import CardSkeleton from '../components/CardSkeleton';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import CatalogHeader from '../components/CatalogHeader';
import { useCombos, COMBOS_PAGE_SIZE } from '../application/hooks/useCombos';
import '../styles/catalog.css';

export default function CombosPage() {
  const navigate = useNavigate();
  const catalog = useCombos();

  return (
    <div className="catalog-root">
      <CatalogHeader />

      <section className="catalog-hero">
        <h1 className="catalog-hero-title">🎁 Combos disponibles</h1>
        <p className="catalog-hero-sub">
          {catalog.loading ? '' : `${catalog.filtered.length} ${catalog.filtered.length === 1 ? 'combo' : 'combos'} disponibles`}
        </p>
        <input
          className="catalog-search"
          type="search"
          placeholder="Buscar combo..."
          value={catalog.search}
          onChange={(e) => catalog.onSearchChange(e.target.value)}
        />
      </section>

      {catalog.comboCantidades.length > 0 && (
        <div className="catalog-filter-bar" style={{ justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
          <span className="filter-label" style={{ margin: 0, alignSelf: 'center' }}>Cantidad:</span>
          {catalog.comboCantidades.map((qty) => (
            <button
              key={qty}
              className={`chip ${catalog.activeComboCantidades.has(qty) ? 'chip--active' : ''}`}
              onClick={() => catalog.toggleComboCantidad(qty)}
            >
              {qty} perfumes
            </button>
          ))}
          {catalog.hasActiveFilters && (
            <button className="filter-clear" onClick={catalog.clearAll}>
              Limpiar
            </button>
          )}
        </div>
      )}

      <div className="catalog-body" style={{ display: 'block', padding: '0 24px' }}>
        <main className="catalog-main" style={{ maxWidth: '100%' }}>
          {catalog.error && <p className="catalog-error">{catalog.error}</p>}

          {!catalog.loading && !catalog.error && catalog.filtered.length === 0 && (
            <div className="catalog-empty">
              <span>🔍</span>
              <p>Sin resultados para los filtros aplicados</p>
            </div>
          )}

          <div className="catalog-combos-grid">
            {catalog.loading ? (
              <CardSkeleton count={6} />
            ) : (
              catalog.paginated.map((c) => (
                <ComboCard key={c.id} combo={c} />
              ))
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
      </div>

      <WhatsAppFab />
      <CartFab />
    </div>
  );
}
