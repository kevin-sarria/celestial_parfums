import { useNavigate } from 'react-router-dom';
import type { Combo } from '../domain/entities/combo.schema';
import { toSlug } from '../utils/slug';

interface Props {
  combo: Combo;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);

export default function ComboCard({ combo: c }: Props) {
  const navigate = useNavigate();
  const precioFinal =
    c.descuento > 0 ? Math.round(c.precio * (1 - c.descuento / 100)) : c.precio;

  return (
    <div
      className="combo-card combo-card--clickable"
      onClick={() => navigate(`/combo/${toSlug(c.nombre)}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/combo/${toSlug(c.nombre)}`)}
    >
      {c.imagen_url && (
        <img src={c.imagen_url} alt={c.nombre} className="combo-card-img" />
      )}
      <div className="combo-card-header">
        <h3 className="combo-card-name">{c.nombre}</h3>
        <span className="combo-card-qty">{c.cantidad} perfumes</span>
      </div>
      {c.categoria && (
        <span className="combo-card-categoria">{c.categoria}</span>
      )}
      {c.descripcion && (
        <p className="combo-card-desc">{c.descripcion}</p>
      )}
      <div className="combo-card-footer">
        {c.descuento > 0 ? (
          <div className="combo-card-price combo-card-price--discount">
            <span className="combo-card-price-original">{fmt(c.precio)}</span>
            <span>{fmt(precioFinal)}</span>
          </div>
        ) : (
          <span className="combo-card-price">{fmt(c.precio)}</span>
        )}
        {c.descuento > 0 && (
          <span className="combo-card-discount-tag">-{c.descuento}%</span>
        )}
      </div>
    </div>
  );
}
