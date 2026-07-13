import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu, SprayCan, Flower2, CalendarDays, Tags, Ruler, Gift,
  BadgePercent, CircleDollarSign, ClipboardList, Factory, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import { useAuthContext } from '../../application/context/useAuthContext';
import { useGuardedFetch } from './useGuardedFetch';
import { API, API_COMBOS, DEFAULT_PAGE_SIZE } from './helpers';
import type { Tab, Lookup } from './types';
import { PerfumesTab } from './tabs/PerfumesTab';
import { CombosTab } from './tabs/CombosTab';
import { DescuentosTab } from './tabs/DescuentosTab';
import { LookupTab } from './tabs/LookupTab';
import { VentasTab } from './tabs/VentasTab';
import { CreditosTab } from './tabs/CreditosTab';
import { PagosTab } from './tabs/PagosTab';
import PerfumeSpinner from '../../components/PerfumeSpinner';

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
};

const TABS = Object.keys(TAB_META) as Tab[];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthContext();
  const guardedFetch = useGuardedFetch();

  const [tab, setTab] = useState<Tab>('perfumes');
  const [loading, setLoading] = useState(true);

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
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <span className="select-none font-display text-[15.5px] font-medium tracking-wide text-foreground">
          <span className="text-primary">✦</span> Celestial Parfums
          <span className="ml-2 hidden text-[11px] font-sans font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline">
            Admin
          </span>
        </span>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/catalog">Ver catalogo</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </header>

      {/* ── Tabs escritorio ── */}
      <nav className="hidden shrink-0 items-center gap-0 overflow-x-auto border-b border-border bg-card px-3 min-[1200px]:flex">
        {TABS.map(t => {
          const { label, icon: Icon } = TAB_META[t];
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={cn(
                'relative flex items-center gap-1.5 px-3.5 py-3 text-[13px] font-medium transition-colors',
                active
                  ? 'text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ── Selector móvil (dropdown) ── */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-4 py-2 min-[1200px]:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-8" aria-label="Abrir menu de apartados">
              <Menu className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {TABS.map(t => {
              const { label, icon: Icon } = TAB_META[t];
              return (
                <DropdownMenuItem
                  key={t}
                  onClick={() => handleTabChange(t)}
                  className={cn(tab === t && 'bg-secondary font-semibold text-primary')}
                >
                  <Icon className="size-4" />
                  {label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
          <ActiveIcon className="size-4" />
          {TAB_META[tab].label}
        </span>
      </div>

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
                categorias={categorias} guardedFetch={guardedFetch}
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
          </>
        )}
      </main>
    </div>
  );
}
