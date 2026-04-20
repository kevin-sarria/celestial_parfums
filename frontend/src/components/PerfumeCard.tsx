import { useNavigate } from 'react-router-dom';
import type { Perfume } from '../domain/entities/perfume.schema';
import { toSlug } from '../utils/slug';

interface Props {
  perfume: Perfume;
}

const AROMA_EMOJI: Record<string, string> = {
  Dulce: '🍯',
  Cítrico: '🍋',
  Amaderado: '🌿',
  Fresco: '💧',
  Aromático: '🌸',
  Oriental: '🕌',
  Floral: '🌺',
};

export default function PerfumeCard({ perfume }: Props) {
  const navigate = useNavigate();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <article
      className="pcard pcard--clickable"
      onClick={() => navigate(`/perfume/${toSlug(perfume.nombre)}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/perfume/${toSlug(perfume.nombre)}`)}
    >
      <div className="pcard-img">
        {perfume.imagen_url ? (
          <img src={perfume.imagen_url} alt={perfume.nombre} loading="lazy" />
        ) : (
          <div className="pcard-img-placeholder">
            <span className="pcard-placeholder-icon">𝒫</span>
          </div>
        )}
        {perfume.descuento > 0 ? (
          <div className="pcard-price-badge pcard-price-badge--discount">
            <span className="pcard-price-original">{formatPrice(perfume.precio)}</span>
            {formatPrice(Math.round(perfume.precio * (1 - perfume.descuento / 100)))}
          </div>
        ) : (
          <div className="pcard-price-badge">{formatPrice(perfume.precio)}</div>
        )}
        {perfume.descuento > 0 && (
          <div className="pcard-discount-badge">-{perfume.descuento}%</div>
        )}
        {perfume.genero && (
          <div className={`pcard-genero-badge pcard-genero-badge--${perfume.genero}`}>
            {perfume.genero === 'hombre' ? '♂' : '♀'}
          </div>
        )}
      </div>

      <div className="pcard-body">
        <div className="pcard-title-row">
          <h3 className="pcard-name">{perfume.nombre}</h3>
          {perfume.categoria && (
            <span className="tag tag--categoria">{perfume.categoria}</span>
          )}
        </div>

        {perfume.descripcion && (
          <p className="pcard-desc">{perfume.descripcion}</p>
        )}

        {perfume.tipos_aroma.length > 0 && (
          <div className="pcard-tags">
            {perfume.tipos_aroma.map((a) => (
              <span key={a} className="tag tag--aroma">
                {AROMA_EMOJI[a] ?? '✦'} {a}
              </span>
            ))}
          </div>
        )}

        {perfume.ocasiones.length > 0 && (
          <div className="pcard-tags">
            {perfume.ocasiones.map((o) => (
              <span key={o} className="tag tag--ocasion">{o}</span>
            ))}
          </div>
        )}

        <div className="pcard-meta">
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
      </div>
    </article>
  );
}
