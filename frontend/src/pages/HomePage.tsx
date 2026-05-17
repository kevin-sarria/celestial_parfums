import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PerfumeCard from '../components/PerfumeCard';
import ComboCard from '../components/ComboCard';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import { useAuthContext } from '../application/context/useAuthContext';
import { useCatalog } from '../application/hooks/useCatalog';
import '../styles/catalog.css';

interface Props {
  isAdmin?: boolean;
  adminPreview?: boolean;
}

export default function HomePage({ isAdmin = false, adminPreview = false }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const catalog = useCatalog();

  useEffect(() => {
    if (isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="catalog-root">
      {adminPreview && (
        <div className="catalog-admin-bar">
          <span className="catalog-admin-bar-label">
            👁 Vista previa del catálogo — modo administrador
          </span>
          <button
            className="catalog-admin-bar-back"
            onClick={() => navigate('/dashboard')}
          >
            ← Volver al dashboard
          </button>
        </div>
      )}

      <header className="catalog-header">
        <div className="catalog-header-inner">
          <span className="catalog-brand">✦ Celestial Parfums</span>
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
        <h1 className="catalog-hero-title">Descubre tu fragancia</h1>
        <p className="catalog-hero-sub">
          Colección exclusiva de perfumes seleccionados para cada momento
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

          {catalog.comboCantidades.length > 0 && (
            <div className="filter-section">
              <p className="filter-label">Combos</p>
              <div className="filter-chips">
                {catalog.comboCantidades.map((qty) => (
                  <button
                    key={qty}
                    className={`chip ${catalog.activeComboCantidades.has(qty) ? 'chip--active' : ''}`}
                    onClick={() => catalog.toggleComboCantidad(qty)}
                  >
                    {qty} perfumes
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {!catalog.loading &&
            !catalog.error &&
            catalog.filteredCombos.length === 0 &&
            (!catalog.showPerfumes || catalog.filtered.length === 0) && (
              <div className="catalog-empty">
                <span>🔍</span>
                <p>Sin resultados para los filtros aplicados</p>
              </div>
            )}

          {/* Perfumes individuales */}
          {!catalog.loading && catalog.showPerfumes && catalog.filtered.length > 0 && (
            <div className="catalog-perfumes">
              <div className="catalog-section-header">
                <p className="catalog-perfumes-title">🧴 Perfumes individuales</p>
                {catalog.hasMorePerfumes && (
                  <Link to="/perfumes" className="catalog-ver-mas">
                    Ver todos ({catalog.filtered.length}) →
                  </Link>
                )}
              </div>
              <div className="catalog-grid">
                {catalog.previewPerfumes.map((p) => (
                  <PerfumeCard key={p.id} perfume={p} />
                ))}
              </div>
            </div>
          )}

          {/* Combos */}
          {!catalog.loading && catalog.filteredCombos.length > 0 && (
            <div className="catalog-combos">
              <div className="catalog-section-header">
                <p className="catalog-combos-title">🎁 Combos disponibles</p>
                {catalog.hasMoreCombos && (
                  <Link to="/combos" className="catalog-ver-mas">
                    Ver todos ({catalog.filteredCombos.length}) →
                  </Link>
                )}
              </div>
              <div className="catalog-combos-grid">
                {catalog.previewCombos.map((c) => (
                  <ComboCard key={c.id} combo={c} />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <WhatsAppFab />
      <CartFab />
    </div>
  );
}
