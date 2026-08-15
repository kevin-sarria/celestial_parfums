import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Menu, ChevronDown, Store, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuthContext } from '../../application/context/useAuthContext';
import BackupSeguridad from './BackupSeguridad';
import { BrandMark } from '../../components/BrandMark';
import { NAV_SECTIONS, TAB_META, TAB_POR_DEFECTO, esTabValido, sectionOfTab } from './navegacion';
import type { GuardedFetch, Tab } from './types';

/**
 * El menú lateral del dashboard, con su propio estado.
 *
 * **Vive aparte de la página a propósito, y no es por ordenar archivos.**
 * Cuando "abierto/cerrado" era estado de `DashboardPage`, cada toque del menú
 * volvía a dibujar la página entera —tabla incluida— justo mientras el cajón
 * se deslizaba. Medido el 2026-08-14 sobre la pantalla de Perfumes: tirones de
 * 76-90 ms al abrir y 53-62 ms al cerrar, en cada vuelta. Un fotograma dura
 * 16 ms, así que se perdían cinco seguidos y el dueño lo describió como
 * parpadeo. En una pantalla ligera no pasaba nada, y eso delató al culpable:
 * no era el cajón, era la pantalla de atrás repintándose sin motivo.
 *
 * Con el estado aquí dentro, abrir y cerrar solo redibuja el menú.
 */
export function MenuLateral({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const navigate = useNavigate();
  const { logout } = useAuthContext();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const tab: Tab = esTabValido(tabParam) ? tabParam : TAB_POR_DEFECTO;

  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Secciones desplegadas; la del apartado actual arranca abierta. */
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set([sectionOfTab(tab)]));

  const toggleSection = (id: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /**
   * Al elegir apartado se navega y se cierra. La sección del destino se deja
   * abierta: si no, al volver a abrir el menú habría que adivinar en qué grupo
   * está uno parado.
   */
  const handleTabChange = (t: Tab) => {
    setOpenSections(prev => new Set(prev).add(sectionOfTab(t)));
    navigate(`/dashboard/${t}`);
    setDrawerOpen(false);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger asChild>
        <button
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="Abrir menú de apartados"
        >
          <Menu className="size-4.5" />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-border/70 p-5">
          <SheetTitle className="flex items-center text-left font-display text-[16px] font-medium tracking-wide text-ink">
            <BrandMark className="mr-2 size-6" />
            Celestial Parfums
            <span className="ml-2 text-[10px] font-sans font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Admin
            </span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-3">
          {NAV_SECTIONS.map(sec => {
            const abierta = openSections.has(sec.id);
            const contieneActiva = sec.tabs.includes(tab);
            return (
              <div key={sec.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(sec.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
                    contieneActiva ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {sec.label}
                  <ChevronDown className={cn('size-3.5 transition-transform duration-200', abierta && 'rotate-180')} />
                </button>

                {abierta && (
                  <div className="mb-2 flex flex-col gap-0.5">
                    {sec.tabs.map(t => {
                      const { label, icon: Icon } = TAB_META[t];
                      const activa = tab === t;
                      return (
                        <button
                          key={t}
                          onClick={() => handleTabChange(t)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors',
                            activa ? 'bg-brand-soft text-primary' : 'text-foreground hover:bg-secondary',
                          )}
                        >
                          <Icon className="size-4.5 shrink-0" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/**
          * Acciones que no son navegación.
          *
          * El **respaldo** vive aquí en TODOS los tamaños desde el
          * 2026-08-11: en la barra de arriba, con la campana al lado, el
          * nombre de la tienda se truncaba a "Celestial Parfu…" y el dueño
          * lo rechazó. Además es mantenimiento semanal, no trabajo del día
          * — mismo criterio que las descargas de Excel en Inventario. El
          * recordatorio de que hace días no se hace copia NO se perdió al
          * esconderlo: pasó a ser una línea del centro de notificaciones.
          *
          * Ver catálogo y Salir siguen apareciendo solo en pantalla
          * pequeña, porque arriba sí caben.
          */}
        <div className="border-t border-border/70 p-4">
          <div className="flex flex-col gap-2">
            <BackupSeguridad guardedFetch={guardedFetch} enMenu />
            <Button variant="ghost" className="w-full justify-start sm:hidden" asChild>
              <Link to="/catalog" onClick={() => setDrawerOpen(false)}>
                <Store className="size-4" /> Ver catalogo
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start sm:hidden"
              onClick={handleLogout}>
              <LogOut className="size-4" /> Salir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
