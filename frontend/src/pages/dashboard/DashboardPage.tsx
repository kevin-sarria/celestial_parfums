import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import '../../styles/dashboard.css';

const TAB_LABELS: Record<Tab, string> = {
  perfumes: '🧴 Perfumes', aromas: '🌸 Aromas', ocasiones: '🗓 Ocasiones',
  categorias: '🏷 Categorias', presentaciones: '📏 Presentaciones', combos: '🎁 Combos',
  descuentos: '💲 Descuentos', ventas: '💰 Ventas', creditos: '📋 Creditos', pagos: '🏭 Proveedores',
};

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

  const [combos, setCombos] = useState<Combo[]>([]);
  const [combosPage, setCombosPage] = useState(1);
  const [combosTotal, setCombosTotal] = useState(0);
  const [combosPageSize, setCombosPageSize] = useState(DEFAULT_PAGE_SIZE);

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

  const loadPerfumes = async (page = perfumesPage, size = perfumesPageSize) => {
    const res = await guardedFetch(`${API}/?page=${page}&limit=${size}`);
    const json = await res.json();
    setPerfumes(json.data ?? []); setPerfumesTotal(json.total ?? 0); setPerfumesPage(page);
  };

  const loadCombos = async (page = combosPage, size = combosPageSize) => {
    const res = await guardedFetch(`${API_COMBOS}?page=${page}&limit=${size}`);
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

  return (
    <div className="dash-root">
      <header className="dash-header">
        <span className="dash-brand">✦ Celestial Parfums</span>
        <div className="dash-header-right">
          <Link to="/catalog" className="dash-btn-ghost">Ver catalogo</Link>
          <button className="dash-btn-ghost" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <nav className="dash-tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button key={t} className={`dash-tab${tab === t ? ' dash-tab--active' : ''}`} onClick={() => handleTabChange(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      <main className="dash-main">
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
                onMutate={refreshAll}
              />
            )}
            {tab === 'aromas' && (
              <LookupTab title="Tipos de Aroma" items={aromas} placeholder="Nuevo aroma..."
                onAdd={handleLookupAdd('tipos-aroma')} onDelete={handleLookupDelete('tipos-aroma')} />
            )}
            {tab === 'ocasiones' && (
              <LookupTab title="Ocasiones" items={ocasiones} placeholder="Nueva ocasion..."
                onAdd={handleLookupAdd('ocasiones')} onDelete={handleLookupDelete('ocasiones')} />
            )}
            {tab === 'categorias' && (
              <LookupTab title="Categorias" items={categorias} placeholder="Nueva categoria..."
                onAdd={handleLookupAdd('categorias')} onDelete={handleLookupDelete('categorias')} />
            )}
            {tab === 'presentaciones' && (
              <LookupTab title="Presentaciones" items={presentaciones} placeholder="Nueva presentacion (ej: 30ML)..."
                onAdd={handleLookupAdd('presentaciones')} onDelete={handleLookupDelete('presentaciones')} />
            )}
            {tab === 'combos' && (
              <CombosTab
                combos={combos} page={combosPage} total={combosTotal} pageSize={combosPageSize}
                categorias={categorias} guardedFetch={guardedFetch}
                onPageChange={p => loadCombos(p, combosPageSize)}
                onPageSizeChange={s => { setCombosPageSize(s); loadCombos(1, s); }}
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
