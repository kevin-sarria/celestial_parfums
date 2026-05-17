import { useNavigate } from 'react-router-dom';
import Paginator from '../components/Paginator';
import ComboCard from '../components/ComboCard';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import { useAuthContext } from '../application/context/useAuthContext';
import { useCombos, COMBOS_PAGE_SIZE } from '../application/hooks/useCombos';
import '../styles/catalog.css';

export default function CombosPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const catalog = useCombos();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="catalog-root">
      <header className="catalog-header">
        <div className="catalog-header-inner">
          <span
            className="catalog-brand"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            ✦ Celestial Parfums
          </span>
          <div className="catalog-header-actions">
            {user ? (
              <>
                <span className="catalog-user-email">{`${user.nombre} ${user.apellido}`}</span>
                <button className="catalog-btn-ghost" onClick={handleLogout}>
                  Salir
                </button>
              </>
            ) : (
              <button
                className="catalog-btn-accent"
                onClick={() => navigate('/login')}
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>

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
            {catalog.paginated.map((c) => (
              <ComboCard key={c.id} combo={c} />
            ))}
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
