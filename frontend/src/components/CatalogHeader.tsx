import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, LogOut, Home, SprayCan, Gift, Mail, HandCoins, Sparkles, Star, ShoppingBag, Heart, Newspaper, Info, Share2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/BrandMark';
import { useAuthContext } from '../application/context/useAuthContext';
import { usePortalCredito } from '../application/hooks/usePortalCredito';

interface Props {
  isHome?: boolean;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// El menú se agrupa en 3 bloques a propósito (neuromarketing):
//  1) TIENDA: el camino de compra va PRIMERO (efecto de primacía) y en orden de
//     embudo: descubrir → explorar → agrupar → decidir.
//  2) MI CUENTA: lo personal junto (chunking = menos carga mental).
//  3) CONTACTO: cierre al FINAL (efecto de recencia) = el CTA de WhatsApp que
//     queremos que recuerden justo cuando están listos para pedir.
const NAV_TIENDA: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/perfumes', label: 'Perfumes', icon: SprayCan },
  { to: '/combos', label: 'Combos', icon: Gift },
  { to: '/blog', label: 'Blog', icon: Newspaper },
];

export default function CatalogHeader({ isHome = false }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // "Mi crédito" solo aparece si el cliente tiene un crédito activo con el negocio
  const { data: portalCredito } = usePortalCredito();
  // Grupo TIENDA: "Tu perfume ideal" (quiz que ayuda a decidir) cierra el embudo,
  // solo para registrados.
  const grupoTienda: NavItem[] = [
    ...NAV_TIENDA,
    ...(user ? [{ to: '/perfume-ideal', label: 'Tu perfume ideal', icon: Sparkles }] : []),
  ];
  // Grupo MI CUENTA: exclusivo de registrados (recompensas, compras y crédito activo).
  const grupoCuenta: NavItem[] = user
    ? [
        { to: '/mis-favoritos', label: 'Mis favoritos', icon: Heart },
        { to: '/mis-recompensas', label: 'Mis recompensas', icon: Star },
        { to: '/mis-compras', label: 'Mis compras', icon: ShoppingBag },
        { to: '/invita', label: 'Invita y gana', icon: Share2 },
        ...(portalCredito?.tiene_credito_activo
          ? [{ to: '/mi-credito', label: 'Mi crédito', icon: HandCoins }]
          : []),
      ]
    : [];
  // Grupo CONTACTO: nosotros + el CTA de cierre.
  const grupoContacto: NavItem[] = [
    { to: '/nosotros', label: 'Sobre nosotros', icon: Info },
    { to: '/contactame', label: 'Contáctame', icon: Mail },
  ];
  const grupos = [grupoTienda, grupoCuenta, grupoContacto].filter((g) => g.length > 0);

  const handleLogout = () => {
    setDrawerOpen(false);
    logout();
    navigate('/login');
  };

  const Brand = (
    <span
      className="group inline-flex select-none items-center font-display text-[17px] font-medium tracking-wide text-ink"
      style={isHome ? undefined : { cursor: 'pointer' }}
      onClick={isHome ? undefined : () => navigate('/')}
    >
      <BrandMark className="mr-2 size-7 transition-transform duration-500 group-hover:scale-110" />
      Celestial Parfums
    </span>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-8">
        {Brand}

        {/* ── Burger + drawer (todas las pantallas) ── */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              aria-label="Abrir menú"
            >
              <Menu className="size-4.5" />
            </button>
          </SheetTrigger>

          <SheetContent side="right" className="w-72 gap-0 p-0">
              <SheetHeader className="border-b border-border/70 p-5">
                <SheetTitle className="flex items-center text-left font-display text-[17px] font-medium tracking-wide text-ink">
                  <BrandMark className="mr-2 size-7" />
                  Celestial Parfums
                </SheetTitle>
              </SheetHeader>

              {/* Sesión iniciada: saludo */}
              {user && (
                <div className="px-5 pt-4 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Hola
                  </p>
                  <p className="mt-0.5 text-[15px] font-medium text-foreground">
                    {`${user.nombre} ${user.apellido}`}
                  </p>
                </div>
              )}

              <nav className="flex flex-col p-3">
                {grupos.map((grupo, gi) => (
                  <div key={gi} className="flex flex-col gap-1">
                    {/* Separador entre grupos = da la agrupación visual sin recargar */}
                    {gi > 0 && <Separator className="my-2" />}
                    {grupo.map(({ to, label, icon: Icon, end }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        onClick={() => setDrawerOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-xl px-3.5 py-3 text-[14.5px] font-medium transition-colors',
                            isActive
                              ? 'bg-brand-soft text-primary'
                              : 'text-foreground hover:bg-secondary',
                          )
                        }
                      >
                        <Icon className="size-4.5 shrink-0" />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </nav>

              <div className="mt-auto p-5">
                <Separator className="mb-4" />
                {user ? (
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    <LogOut className="size-4" />
                    Cerrar sesión
                  </Button>
                ) : (
                  <Button
                    className="w-full rounded-full"
                    onClick={() => {
                      setDrawerOpen(false);
                      navigate('/login');
                    }}
                  >
                    Iniciar sesión
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
      </div>
    </header>
  );
}
