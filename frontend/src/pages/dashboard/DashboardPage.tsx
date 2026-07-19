import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu, ChevronDown, SprayCan, Flower2, CalendarDays, Tags, Ruler, Gift, BadgePercent,
  CircleDollarSign, ClipboardList, Factory, Share2, Users, Megaphone, Store, LogOut, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import { useAuthContext } from '../../application/context/useAuthContext';
import { useGuardedFetch } from './useGuardedFetch';
import { useSeo } from '../../application/hooks/useSeo';
import { API, API_COMBOS, DEFAULT_PAGE_SIZE } from './helpers';
import type { Tab, Lookup } from './types';
import { PerfumesTab } from './tabs/PerfumesTab';
import { CombosTab } from './tabs/CombosTab';
import { DescuentosTab } from './tabs/DescuentosTab';
import { LookupTab } from './tabs/LookupTab';
import { VentasTab } from './tabs/VentasTab';
import { CreditosTab } from './tabs/CreditosTab';
import { PagosTab } from './tabs/PagosTab';
import { UsuariosTab } from './tabs/UsuariosTab';
import { PublicidadTab } from './tabs/PublicidadTab';
import { RedesTab } from './tabs/RedesTab';
import PerfumeSpinner from '../../components/PerfumeSpinner';
import { BrandMark } from '../../components/BrandMark';

const TAB_META: Record<Tab, { label: string; icon: LucideIcon }> = {
  perfumes: { label: 'Perfumes', icon: SprayCan },
  aromas: { label: 'Aromas', icon: Flower2 },
  ocasiones: { label: 'Ocasiones', icon: CalendarDays },
  categorias: { label: 'Categorias', icon: Tags },
  presentaciones: { label: 'Presentaciones', icon: Ruler },
  combos: { label: 'Combos', icon: Gift },
  descuentos: { label: 'Descuentos', icon: BadgePercent },
  ventas: { label: 'Ventas', icon: CircleDollarSign },
  creditos: { label: 'Creditos', icon: ClipboardList },
  pagos: { label: 'Proveedores', icon: Factory },
  usuarios: { label: 'Usuarios', icon: Users },
  publicidad: { label: 'Publicidad', icon: Megaphone },
  redes: { label: 'Redes sociales', icon: Share2 },
};

// Menú del dashboard agrupado en secciones colapsables (drawer con burger)
const NAV_SECTIONS: { id: string; label: string; tabs: Tab[] }[] = [
  { id: 'catalogo', label: 'Catálogo', tabs: ['perfumes', 'combos', 'descuentos'] },
  { id: 'clasificaciones', label: 'Clasificaciones', tabs: ['aromas', 'ocasiones', 'categorias', 'presentaciones'] },
  { id: 'negocio', label: 'Ventas y créditos', tabs: ['ventas', 'creditos', 'pagos'] },
  { id: 'cuentas', label: 'Personas y página', tabs: ['usuarios', 'publicidad', 'redes'] },
];

const sectionOfTab = (tab: Tab) =>
  NAV_SECTIONS.find(s => s.tabs.includes(tab))?.id ?? NAV_SECTIONS[0].id;

export default function DashboardPage() {
  useSeo('Dashboard');
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthContext();
  const guardedFetch = useGuardedFetch();

  const [tab, setTab] = useState<Tab>('perfumes');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Secciones desplegadas del menú; la de la pestaña activa arranca abierta
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set([sectionOfTab('perfumes')]));
  const toggleSection = (id: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [perfumesPage, setPerfumesPage] = useState(1);
  const [perfumesTotal, setPerfumesTotal] = useState(0);
  const [perfumesPageSize, setPerfumesPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [perfumesSearch, setPerfumesSearch] = useState('');

  const [combos, setCombos] = useState<Combo[]>([]);
  const [combosPage, setCombosPage] = useState(1);
  const [combosTotal, setCombosTotal] = useState(0);
  const [combosPageSize, setCombosPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [combosSearch, setCombosSearch] = useState('');

  const [aromas, setAromas] = useState<Lookup[]>([]);
  const [ocasiones, setOcasiones] = useState<Lookup[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [presentaciones, setPresentaciones] = useState<Lookup[]>([]);

  useEffect(() => { if (!user || !isAdmin) navigate('/'); }, [user, isAdmin, navigate]);

  const loadLookups = async () => {
    const [aRes, oRes, cRes, pRes] = await Promise.all([
      fetch(`${API}/tipos-aroma`), fetch(`${API}/ocasiones`), fetch(`${API}/categorias`), fetch(`${API}/presentaciones`),
    ]);
    const [a, o, c, p] = await Promise.all([aRes.json(), oRes.json(), cRes.json(), pRes.json()]);
    setAromas(a.data ?? []); setOcasiones(o.data ?? []); setCategorias(c.data ?? []); setPresentaciones(p.data ?? []);
  };

  const loadPerfumes = async (page = perfumesPage, size = perfumesPageSize, search = perfumesSearch) => {
    const searchQs = search ? `&search=${encodeURIComponent(search)}` : '';
    const res = await guardedFetch(`${API}/?page=${page}&limit=${size}${searchQs}`);
    const json = await res.json();
    setPerfumes(json.data ?? []); setPerfumesTotal(json.total ?? 0); setPerfumesPage(page);
  };

  const loadCombos = async (page = combosPage, size = combosPageSize, search = combosSearch) => {
    const searchQs = search ? `&search=${encodeURIComponent(search)}` : '';
    const res = await guardedFetch(`${API_COMBOS}?page=${page}&limit=${size}${searchQs}`);
    const json = await res.json();
    setCombos(json.data ?? []); setCombosTotal(json.total ?? 0); setCombosPage(page);
  };

  const refreshAll = () => { loadLookups(); loadPerfumes(); loadCombos(); };

  useEffect(() => {
    let active = true;
    Promise.all([
      Promise.all([
        fetch(`${API}/tipos-aroma`), fetch(`${API}/ocasiones`), fetch(`${API}/categorias`), fetch(`${API}/presentaciones`),
      ]).then(rs => Promise.all(rs.map(r => r.json()))),
      guardedFetch(`${API}/?page=1&limit=${DEFAULT_PAGE_SIZE}`).then(r => r.json()),
      guardedFetch(`${API_COMBOS}?page=1&limit=${DEFAULT_PAGE_SIZE}`).then(r => r.json()),
    ]).then(([[a, o, c, pr], p, co]) => {
      if (!active) return;
      setAromas(a.data ?? []); setOcasiones(o.data ?? []); setCategorias(c.data ?? []); setPresentaciones(pr.data ?? []);
      setPerfumes(p.data ?? []); setPerfumesTotal(p.total ?? 0);
      setCombos(co.data ?? []); setCombosTotal(co.total ?? 0);
      setLoading(false);
    });
    return () => { active = false; };
  }, [guardedFetch]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setDrawerOpen(false);
    setOpenSections(prev => new Set(prev).add(sectionOfTab(t)));
    if (t === 'perfumes') loadPerfumes(1);
    if (t === 'combos') loadCombos(1);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleLookupAdd = (endpoint: string) => async (name: string) => {
    await guardedFetch(`${API}/${endpoint}`, { method: 'POST', body: JSON.stringify({ nombre: name }) });
    refreshAll();
  };

  const handleLookupDelete = (endpoint: string) => async (id: number) => {
    if (!window.confirm('¿Eliminar este elemento?')) return;
    await guardedFetch(`${API}/${endpoint}/${id}`, { method: 'DELETE' });
    refreshAll();
  };

  const handleLookupEdit = (endpoint: string) => async (id: number, name: string) => {
    await guardedFetch(`${API}/${endpoint}/${id}`, { method: 'PATCH', body: JSON.stringify({ nombre: name }) });
    refreshAll();
  };

  const ActiveIcon = TAB_META[tab].icon;

  return (
    <div className="dash-root flex h-svh flex-col bg-background">
      {/* ── Header: burger + marca a la izquierda, acciones a la derecha ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
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

              {/* En pantallas pequeñas estas acciones no caben en el header */}
              <div className="border-t border-border/70 p-4 sm:hidden">
                <div className="flex flex-col gap-2">
                  <Button variant="ghost" className="w-full justify-start" asChild>
                    <Link to="/catalog" onClick={() => setDrawerOpen(false)}>
                      <Store className="size-4" /> Ver catalogo
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                    <LogOut className="size-4" /> Salir
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <span className="flex min-w-0 select-none items-center font-display text-[15.5px] font-medium tracking-wide text-foreground">
            <BrandMark className="mr-2 size-6 shrink-0" />
            <span className="truncate">Celestial Parfums</span>
            <span className="ml-2 hidden text-[11px] font-sans font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline">
              Admin
            </span>
          </span>

          {/* Apartado activo */}
          <span className="hidden items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-semibold text-primary md:flex">
            <ActiveIcon className="size-3.5" />
            {TAB_META[tab].label}
          </span>
        </div>

        {/* En celular estas acciones viven dentro del drawer */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/catalog">Ver catalogo</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </header>


      {/* ── Contenido ── */}
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {loading ? (
          <PerfumeSpinner />
        ) : (
          <>
            {tab === 'perfumes' && (
              <PerfumesTab
                perfumes={perfumes} page={perfumesPage} total={perfumesTotal} pageSize={perfumesPageSize}
                aromas={aromas} ocasiones={ocasiones} categorias={categorias} presentaciones={presentaciones}
                guardedFetch={guardedFetch}
                onPageChange={p => loadPerfumes(p, perfumesPageSize)}
                onPageSizeChange={s => { setPerfumesPageSize(s); loadPerfumes(1, s); }}
                onSearch={t => { setPerfumesSearch(t); loadPerfumes(1, perfumesPageSize, t); }}
                onMutate={refreshAll}
              />
            )}
            {tab === 'aromas' && (
              <LookupTab title="Tipos de Aroma" items={aromas} placeholder="Nuevo aroma..."
                onAdd={handleLookupAdd('tipos-aroma')} onDelete={handleLookupDelete('tipos-aroma')} onEdit={handleLookupEdit('tipos-aroma')}
                importEntity="aromas" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'ocasiones' && (
              <LookupTab title="Ocasiones" items={ocasiones} placeholder="Nueva ocasion..."
                onAdd={handleLookupAdd('ocasiones')} onDelete={handleLookupDelete('ocasiones')} onEdit={handleLookupEdit('ocasiones')}
                importEntity="ocasiones" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'categorias' && (
              <LookupTab title="Categorias" items={categorias} placeholder="Nueva categoria..."
                onAdd={handleLookupAdd('categorias')} onDelete={handleLookupDelete('categorias')} onEdit={handleLookupEdit('categorias')}
                importEntity="categorias" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'presentaciones' && (
              <LookupTab title="Presentaciones" items={presentaciones} placeholder="Nueva presentacion (ej: 30ML)..."
                onAdd={handleLookupAdd('presentaciones')} onDelete={handleLookupDelete('presentaciones')} onEdit={handleLookupEdit('presentaciones')}
                importEntity="presentaciones" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'combos' && (
              <CombosTab
                combos={combos} page={combosPage} total={combosTotal} pageSize={combosPageSize}
                categorias={categorias} presentaciones={presentaciones} guardedFetch={guardedFetch}
                onPageChange={p => loadCombos(p, combosPageSize)}
                onPageSizeChange={s => { setCombosPageSize(s); loadCombos(1, s); }}
                onSearch={t => { setCombosSearch(t); loadCombos(1, combosPageSize, t); }}
                onMutate={refreshAll}
              />
            )}
            {tab === 'descuentos' && (
              <DescuentosTab perfumes={perfumes} combos={combos} guardedFetch={guardedFetch} onMutate={refreshAll} />
            )}
            {tab === 'ventas' && <VentasTab guardedFetch={guardedFetch} />}
            {tab === 'creditos' && <CreditosTab guardedFetch={guardedFetch} />}
            {tab === 'pagos' && <PagosTab guardedFetch={guardedFetch} />}
            {tab === 'usuarios' && <UsuariosTab guardedFetch={guardedFetch} />}
            {tab === 'publicidad' && <PublicidadTab guardedFetch={guardedFetch} categorias={categorias} />}
            {tab === 'redes' && <RedesTab guardedFetch={guardedFetch} />}
          </>
        )}
      </main>
    </div>
  );
}
