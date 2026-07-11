import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../application/context/useAuthContext';
import './CatalogHeader.css';

interface Props {
  isHome?: boolean;
}

export default function CatalogHeader({ isHome = false }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <header className="catalog-header">
      <div className="catalog-header-inner">
        <span
          className="catalog-brand"
          style={isHome ? undefined : { cursor: 'pointer' }}
          onClick={isHome ? undefined : () => navigate('/')}
        >
          ✦ Celestial Parfums
        </span>
        <div className="catalog-header-actions">
          {user ? (
            <>
              <span className="catalog-user-email">{`${user.nombre} ${user.apellido}`}</span>
              <button className="catalog-btn-ghost catalog-btn-logout" onClick={handleLogout}>
                Salir
              </button>

              <div className="user-menu-mobile" ref={menuRef}>
                <button
                  className="user-menu-trigger"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Menú de usuario"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="user-menu-dropdown">
                    <span className="user-menu-name">{`${user.nombre} ${user.apellido}`}</span>
                    <hr className="user-menu-divider" />
                    <button className="user-menu-item" onClick={handleLogout}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button className="catalog-btn-accent" onClick={() => navigate('/login')}>
              Iniciar sesión
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
