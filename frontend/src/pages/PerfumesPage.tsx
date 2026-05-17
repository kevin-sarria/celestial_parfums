import { useNavigate } from 'react-router-dom';
import PerfumeCard from '../components/PerfumeCard';
import Paginator from '../components/Paginator';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import { useAuthContext } from '../application/context/useAuthContext';
import { usePerfumes, PERFUMES_PAGE_SIZE } from '../application/hooks/usePerfumes';
import '../styles/catalog.css';

export default function PerfumesPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const catalog = usePerfumes();

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
        <h1 className="catalog-hero-title">Perfumes individuales</h1>
        <p className="catalog-hero-sub">
          {catalog.loading ? '' : `${catalog.filtered.length} ${catalog.filtered.length === 1 ? 'perfume' : 'perfumes'} disponibles`}
        </p>
        <input
          className="catalog-search"
          type="search"
          placeholder="Buscar perfume..."
          value={catalog.search}
          onChange={(e) => catalog.onSearchChange(e.target.value)}
        />
      </section>

      <div className="catalog-filter-bar">
        <button
          className={`catalog-filter-toggle ${catalog.showFilters ? 'catalog-filter-toggle--active' : ''}`}
          onClick={() => catalog.setShowFilters((v) => !v)}
        >
          ⚙ Filtros {catalog.hasActiveFilters && <span className="filter-dot" />}
        </button>
        {catalog.hasActiveFilters && (
          <button className="filter-clear" onClick={catalog.clearAll}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="catalog-body">
        <aside
          className={`catalog-sidebar ${catalog.showFilters ? 'catalog-sidebar--open' : ''}`}
        >
          <div className="filter-section">
            <p className="filter-label">Género</p>
            <div className="filter-chips">
              {(['hombre', 'mujer'] as const).map((g) => (
                <button
                  key={g}
                  className={`chip ${catalog.activeGenero === g ? 'chip--active' : ''}`}
                  onClick={() => catalog.onGeneroToggle(g)}
                >
                  {g === 'hombre' ? '♂ Hombre' : '♀ Mujer'}
                </button>
              ))}
            </div>
          </div>

          {catalog.categorias.length > 0 && (
            <div className="filter-section">
              <p className="filter-label">Categoría</p>
              <div className="filter-chips">
                {catalog.categorias.map((c) => (
                  <button
                    key={c.id}
                    className={`chip ${catalog.activeCategorias.has(c.nombre) ? 'chip--active' : ''}`}
                    onClick={() =>
                      catalog.toggleStringSet(c.nombre, catalog.activeCategorias, catalog.setActiveCategorias)
                    }
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-section">
            <p className="filter-label">Notas &amp; Aromas</p>
            <div className="filter-chips">
              {catalog.allAromas.map((a) => (
                <button
                  key={a}
                  className={`chip ${catalog.activeAromas.has(a) ? 'chip--active' : ''}`}
                  onClick={() =>
                    catalog.toggleStringSet(a, catalog.activeAromas, catalog.setActiveAromas)
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <p className="filter-label">Ocasiones</p>
            <div className="filter-chips">
              {catalog.allOcasiones.map((o) => (
                <button
                  key={o}
                  className={`chip ${catalog.activeOcasiones.has(o) ? 'chip--active' : ''}`}
                  onClick={() =>
                    catalog.toggleStringSet(o, catalog.activeOcasiones, catalog.setActiveOcasiones)
                  }
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {catalog.hasActiveFilters && (
            <button
              className="filter-clear filter-clear--desktop"
              onClick={catalog.clearAll}
            >
              Limpiar filtros
            </button>
          )}
        </aside>

        <main className="catalog-main">
          {catalog.error && <p className="catalog-error">{catalog.error}</p>}

          {!catalog.loading && !catalog.error && catalog.filtered.length === 0 && (
            <div className="catalog-empty">
              <span>🔍</span>
              <p>Sin resultados para los filtros aplicados</p>
            </div>
          )}

          <div className="catalog-grid">
            {catalog.paginated.map((p) => (
              <PerfumeCard key={p.id} perfume={p} />
            ))}
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
