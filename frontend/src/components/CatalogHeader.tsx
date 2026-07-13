import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthContext } from '../application/context/useAuthContext';

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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-8">
        <span
          className="group select-none font-display text-[17px] font-medium tracking-wide text-ink"
          style={isHome ? undefined : { cursor: 'pointer' }}
          onClick={isHome ? undefined : () => navigate('/')}
        >
          <span className="inline-block text-primary transition-transform duration-500 group-hover:rotate-[45deg]">
            ✦
          </span>{' '}
          Celestial Parfums
        </span>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-[13px] text-muted-foreground sm:inline">
                {`${user.nombre} ${user.apellido}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={handleLogout}
              >
                Salir
              </Button>

              {/* Menú de usuario en móvil */}
              <div className="relative sm:hidden" ref={menuRef}>
                <button
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Menú de usuario"
                >
                  <User className="size-[18px]" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-xl border border-border bg-popover p-2 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.2)] animate-fade-up">
                    <span className="block px-2.5 py-1.5 text-[13px] font-medium text-foreground">
                      {`${user.nombre} ${user.apellido}`}
                    </span>
                    <Separator className="my-1.5" />
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      onClick={handleLogout}
                    >
                      <LogOut className="size-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Button size="sm" className="rounded-full px-5" onClick={() => navigate('/login')}>
              Iniciar sesión
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
