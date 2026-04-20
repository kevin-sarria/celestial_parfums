import { useParams, useNavigate } from 'react-router-dom';
import PerfumeCard from '../components/PerfumeCard';
import { useAuthContext } from '../application/context/useAuthContext';
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
  const { user, logout } = useAuthContext();
  const { perfume, related, loading, error } = usePerfumeDetail(slug);

  const handleLogout = () => { logout(); navigate('/login'); };

  const precioFinal = perfume && perfume.descuento > 0
    ? Math.round(perfume.precio * (1 - perfume.descuento / 100))
    : perfume?.precio ?? 0;

  return (
    <div className="detail-root">
      <header className="catalog-header">
        <div className="catalog-header-inner">
          <span className="catalog-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            ✦ Celestial Parfums
          </span>
          <div className="catalog-header-actions">
            {user ? (
              <>
                <span className="catalog-user-email">{`${user.nombre} ${user.apellido}`}</span>
                <button className="catalog-btn-ghost" onClick={handleLogout}>Salir</button>
              </>
            ) : (
              <button className="catalog-btn-accent" onClick={() => navigate('/login')}>
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="detail-back-bar">
        <button className="detail-back" onClick={() => navigate(-1)}>← Volver</button>
      </div>

      {loading && <div className="detail-loading">Cargando...</div>}

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
              {perfume.imagen_url ? (
                <img src={perfume.imagen_url} alt={perfume.nombre} className="detail-img" />
              ) : (
                <div className="detail-img-placeholder"><span>𝒫</span></div>
              )}
              {perfume.descuento > 0 && (
                <span className="detail-discount-badge">-{perfume.descuento}%</span>
              )}
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

              <a
                className="detail-whatsapp-btn"
                href={`https://wa.me/573163827701?text=${encodeURIComponent(`Hola, me interesa el perfume: ${perfume.nombre}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Consultar por WhatsApp
              </a>
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
    </div>
  );
}
