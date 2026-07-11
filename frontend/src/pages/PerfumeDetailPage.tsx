import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PerfumeCard from '../components/PerfumeCard';
import PerfumeSpinner from '../components/PerfumeSpinner';
import AddToCartModal from '../components/AddToCartModal';
import CartFab from '../components/CartFab';
import CatalogHeader from '../components/CatalogHeader';
import { usePerfumeDetail } from '../application/hooks/usePerfumeDetail';
import '../styles/detail.css';

const AROMA_EMOJI: Record<string, string> = {
  Dulce: '🍯',
  Cítrico: '🍋',
  Amaderado: '🌿',
  Fresco: '💧',
  Aromático: '🌸',
  Oriental: '🕌',
  Floral: '🌺',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);

export default function PerfumeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { perfume, related, loading, error } = usePerfumeDetail(slug);
  const [cartModal, setCartModal] = useState(false);

  const precioFinal = perfume && perfume.descuento > 0
    ? Math.round(perfume.precio * (1 - perfume.descuento / 100))
    : perfume?.precio ?? 0;

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
          <button className="detail-back" onClick={() => navigate('/perfumes')}>
            Ver todos los perfumes
          </button>
        </div>
      )}

      {!loading && perfume && (
        <>
          <main className="detail-main">
            <div className="detail-img-col">
              <div className="detail-img-wrap">
                {perfume.imagen_url ? (
                  <img src={perfume.imagen_url} alt={perfume.nombre} className="detail-img" />
                ) : (
                  <div className="detail-img-placeholder"><span>𝒫</span></div>
                )}
                {perfume.descuento > 0 && (
                  <span className="detail-discount-badge">-{perfume.descuento}%</span>
                )}
              </div>
            </div>

            <div className="detail-info-col">
              <div className="detail-title-row">
                <h1 className="detail-name">{perfume.nombre}</h1>
                {perfume.genero && (
                  <span className={`detail-genero detail-genero--${perfume.genero}`}>
                    {perfume.genero === 'hombre' ? '♂ Hombre' : '♀ Mujer'}
                  </span>
                )}
              </div>

              {perfume.categoria && (
                <span className="tag tag--categoria">{perfume.categoria}</span>
              )}

              <div className="detail-price-block">
                {perfume.descuento > 0 ? (
                  <>
                    <span className="detail-price-original">{fmt(perfume.precio)}</span>
                    <span className="detail-price">{fmt(precioFinal)}</span>
                  </>
                ) : (
                  <span className="detail-price">{fmt(perfume.precio)}</span>
                )}
              </div>

              {perfume.descripcion && (
                <p className="detail-description">{perfume.descripcion}</p>
              )}

              {perfume.tipos_aroma.length > 0 && (
                <div className="detail-section">
                  <p className="detail-section-label">Notas &amp; Aromas</p>
                  <div className="pcard-tags">
                    {perfume.tipos_aroma.map((a) => (
                      <span key={a} className="tag tag--aroma">
                        {AROMA_EMOJI[a] ?? '✦'} {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {perfume.ocasiones.length > 0 && (
                <div className="detail-section">
                  <p className="detail-section-label">Ocasiones</p>
                  <div className="pcard-tags">
                    {perfume.ocasiones.map((o) => (
                      <span key={o} className="tag tag--ocasion">{o}</span>
                    ))}
                  </div>
                </div>
              )}

              {(perfume.duracion || perfume.proyeccion) && (
                <div className="detail-meta">
                  {perfume.duracion && (
                    <span className="pcard-meta-item">
                      <span className="pcard-meta-icon">⏱</span> {perfume.duracion}
                    </span>
                  )}
                  {perfume.proyeccion && (
                    <span className="pcard-meta-item">
                      <span className="pcard-meta-icon">📡</span> {perfume.proyeccion}
                    </span>
                  )}
                </div>
              )}

              {!perfume.agotado && (
                <button className="detail-add-cart-btn" onClick={() => setCartModal(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  Agregar al carrito
                </button>
              )}
            </div>
          </main>

          {related.length > 0 && (
            <section className="detail-related">
              <div className="detail-related-inner">
                <h2 className="detail-related-title">También te puede interesar</h2>
                <div className="detail-related-grid">
                  {related.map((p) => (
                    <PerfumeCard key={p.id} perfume={p} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <CartFab />

      {perfume && (
        <AddToCartModal
          open={cartModal}
          onClose={() => setCartModal(false)}
          producto={{
            id: perfume.id,
            nombre: perfume.nombre,
            precio: precioFinal,
            imagen_url: perfume.imagen_url,
            esCombo: false,
            categoria: perfume.categoria,
            genero: perfume.genero,
            presentaciones: perfume.presentaciones,
          }}
        />
      )}
    </div>
  );
}
