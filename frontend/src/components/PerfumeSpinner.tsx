import './PerfumeSpinner.css';

export default function PerfumeSpinner() {
  return (
    <div className="perfume-spinner">
      <svg viewBox="0 0 60 88" className="perfume-spinner-svg" aria-hidden="true">
        {/* Diamond cap */}
        <polygon className="spinner-cap" points="30,4 40,14 30,20 20,14" />
        <line className="spinner-cap-facet" x1="30" y1="4" x2="30" y2="20" />
        <line className="spinner-cap-facet" x1="20" y1="14" x2="40" y2="14" />

        {/* Neck */}
        <rect className="spinner-neck" x="24" y="20" width="12" height="8" rx="1.5" />

        {/* Body */}
        <rect className="spinner-body" x="12" y="28" width="36" height="48" rx="4" />

        {/* Liquid fill (animated) */}
        <rect className="spinner-liquid" x="13" y="29" width="34" height="46" rx="3" />

        {/* Flower */}
        <line className="spinner-flower-stem" x1="30" y1="66" x2="30" y2="46" />
        <path className="spinner-flower-leaf" d="M30,56 C24,52 24,46 28,44" />
        <path className="spinner-flower-leaf" d="M30,56 C36,52 36,46 32,44" />
        <ellipse className="spinner-flower-petal" cx="27" cy="42" rx="4" ry="6" transform="rotate(-15,27,42)" />
        <ellipse className="spinner-flower-petal" cx="33" cy="42" rx="4" ry="6" transform="rotate(15,33,42)" />
        <circle className="spinner-flower-center" cx="30" cy="42" r="2.5" />
      </svg>

      <span className="perfume-spinner-text">
        Cargando
        <span className="perfume-spinner-dots">
          <span className="perfume-spinner-dot">.</span>
          <span className="perfume-spinner-dot">.</span>
          <span className="perfume-spinner-dot">.</span>
        </span>
      </span>
    </div>
  );
}
