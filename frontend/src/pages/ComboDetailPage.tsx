import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ComboCard from '../components/ComboCard';
import PerfumeSpinner from '../components/PerfumeSpinner';
import AddToCartModal from '../components/AddToCartModal';
import CartFab from '../components/CartFab';
import CatalogHeader from '../components/CatalogHeader';
import { useComboDetail } from '../application/hooks/useComboDetail';
import '../styles/detail.css';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);

export default function ComboDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { combo, related, loading, error } = useComboDetail(slug);
  const [cartModal, setCartModal] = useState(false);

  const precioFinal = combo && combo.descuento > 0
    ? Math.round(combo.precio * (1 - combo.descuento / 100))
    : combo?.precio ?? 0;

  return (
    <div className="detail-root">
      <CatalogHeader />

      <div className="detail-back-bar">
        <button className="detail-back" onClick={() => navigate(-1)}>← Volver</button>
      </div>

      {loading && <PerfumeSpinner />}

      {!loading && error && (
        <div className="detail-error">
          <p>{error}</p>
          <button className="detail-back" onClick={() => navigate('/combos')}>
            Ver todos los combos
          </button>
        </div>
      )}

      {!loading && combo && (
        <>
          <main className="detail-main">
            <div className="detail-img-col">
              <div className="detail-img-wrap">
                {combo.imagen_url ? (
                  <img src={combo.imagen_url} alt={combo.nombre} className="detail-img" />
                ) : (
                  <div className="detail-img-placeholder"><span>🎁</span></div>
                )}
                {combo.descuento > 0 && (
                  <span className="detail-discount-badge">-{combo.descuento}%</span>
                )}
              </div>
            </div>

            <div className="detail-info-col">
              <div className="detail-title-row">
                <h1 className="detail-name">{combo.nombre}</h1>
                <span className="detail-genero">{combo.cantidad} perfumes</span>
              </div>

              {combo.categoria && (
                <span className="tag tag--categoria">{combo.categoria}</span>
              )}

              <div className="detail-price-block">
                {combo.descuento > 0 ? (
                  <>
                    <span className="detail-price-original">{fmt(combo.precio)}</span>
                    <span className="detail-price">{fmt(precioFinal)}</span>
                  </>
                ) : (
                  <span className="detail-price">{fmt(combo.precio)}</span>
                )}
              </div>

              {combo.descripcion && (
                <p className="detail-description">{combo.descripcion}</p>
              )}

              <button className="detail-add-cart-btn" onClick={() => setCartModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                Agregar al carrito
              </button>
            </div>
          </main>

          {related.length > 0 && (
            <section className="detail-related">
              <div className="detail-related-inner">
                <h2 className="detail-related-title">Otros combos disponibles</h2>
                <div className="detail-related-combos-grid">
                  {related.map((c) => (
                    <ComboCard key={c.id} combo={c} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <CartFab />

      {combo && (
        <AddToCartModal
          open={cartModal}
          onClose={() => setCartModal(false)}
          producto={{
            id: combo.id,
            nombre: combo.nombre,
            precio: precioFinal,
            imagen_url: combo.imagen_url,
            esCombo: true,
            categoria: combo.categoria,
            genero: null,
            presentaciones: [],
          }}
        />
      )}
    </div>
  );
}
