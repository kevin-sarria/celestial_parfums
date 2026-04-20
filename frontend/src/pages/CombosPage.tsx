import { useNavigate } from 'react-router-dom';
import Paginator from '../components/Paginator';
import ComboCard from '../components/ComboCard';
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

      <a
        className="whatsapp-fab"
        href="https://wa.me/573163827701"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  );
}
