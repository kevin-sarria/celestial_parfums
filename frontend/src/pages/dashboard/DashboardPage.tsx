import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Menu, ChevronDown, SprayCan, Flower2, CalendarDays, Tags, Ruler, Gift, BadgePercent,
  CircleDollarSign, ClipboardList, Factory, Share2, Users, Megaphone, Star, MessageSquareText, Store, LogOut,
  BellRing, ShoppingCart, Info, Newspaper, FileText, FlaskConical, Boxes, Calculator, PackageX, ChartColumn, Layers, type LucideIcon,
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
import BackupSeguridad from './BackupSeguridad';
import { PerfumesTab } from './tabs/PerfumesTab';
import { CombosTab } from './tabs/CombosTab';
import { PreciosTab } from './tabs/PreciosTab';
import { DescuentosTab } from './tabs/DescuentosTab';
import { LookupTab, type ResultadoLookup } from './tabs/LookupTab';
import { VentasTab } from './tabs/VentasTab';
import { CreditosTab } from './tabs/CreditosTab';
import { PagosTab } from './tabs/PagosTab';
import { UsuariosTab } from './tabs/UsuariosTab';
import { PublicidadTab } from './tabs/PublicidadTab';
import { RecompensasTab } from './tabs/RecompensasTab';
import { ResenasTab } from './tabs/ResenasTab';
import { AvisosTab } from './tabs/AvisosTab';
import { SobreNosotrosTab } from './tabs/SobreNosotrosTab';
import { BlogTab } from './tabs/BlogTab';
import { CotizacionesTab } from './tabs/CotizacionesTab';
import { FormulasVolumenTab } from './tabs/FormulasVolumenTab';
import { GamasTab } from './tabs/GamasTab';
import { CostosProduccionTab } from './tabs/CostosProduccionTab';
import { DevolucionesTab } from './tabs/DevolucionesTab';
import { InventarioTab } from './tabs/InventarioTab';
import { ReposicionTab } from './tabs/ReposicionTab';
import { ProduccionesTab } from './tabs/ProduccionesTab';
import { ReportesVentasTab } from './tabs/ReportesVentasTab';
import { ReportesComprasTab } from './tabs/ReportesComprasTab';
import { ReportesClientesTab } from './tabs/ReportesClientesTab';
import { RedesTab } from './tabs/RedesTab';
import PerfumeSpinner from '../../components/PerfumeSpinner';
import { BrandMark } from '../../components/BrandMark';

const TAB_META: Record<Tab, { label: string; icon: LucideIcon }> = {
  perfumes: { label: 'Perfumes', icon: SprayCan },
  aromas: { label: 'Aromas', icon: Flower2 },
  ocasiones: { label: 'Ocasiones', icon: CalendarDays },
  categorias: { label: 'Categorias', icon: Tags },
  presentaciones: { label: 'Presentaciones', icon: Ruler },
  gamas: { label: 'Gamas de esencia', icon: Layers },
  combos: { label: 'Combos', icon: Gift },
  precios: { label: 'Precios', icon: Tags },
  descuentos: { label: 'Descuentos', icon: BadgePercent },
  ventas: { label: 'Ventas', icon: CircleDollarSign },
  creditos: { label: 'Creditos', icon: ClipboardList },
  devoluciones: { label: 'Devoluciones', icon: PackageX },
  pagos: { label: 'Proveedores', icon: Factory },
  inventario: { label: 'Inventario', icon: Boxes },
  reposicion: { label: 'Pedido sugerido', icon: ShoppingCart },
  producciones: { label: 'Producciones', icon: FlaskConical },
  rep_ventas: { label: 'Reporte de ventas', icon: ChartColumn },
  rep_compras: { label: 'Reporte de compras', icon: ChartColumn },
  rep_clientes: { label: 'Reporte de clientes', icon: ChartColumn },
  usuarios: { label: 'Usuarios', icon: Users },
  publicidad: { label: 'Publicidad', icon: Megaphone },
  recompensas: { label: 'Recompensas', icon: Star },
  resenas: { label: 'Reseñas', icon: MessageSquareText },
  avisos: { label: 'Reposiciones', icon: BellRing },
  nosotros: { label: 'Sobre nosotros', icon: Info },
  blog: { label: 'Blog', icon: Newspaper },
  redes: { label: 'Redes sociales', icon: Share2 },
  cotizaciones: { label: 'Cotizaciones', icon: FileText },
  formulas: { label: 'Tamaños y fórmulas', icon: FlaskConical },
  costos: { label: 'Costos de producción', icon: Calculator },
};

// Menú del dashboard agrupado en secciones colapsables (drawer con burger)
const NAV_SECTIONS: { id: string; label: string; tabs: Tab[] }[] = [
  { id: 'catalogo', label: 'Catálogo', tabs: ['perfumes', 'combos', 'precios', 'descuentos'] },
  { id: 'clasificaciones', label: 'Clasificaciones', tabs: ['aromas', 'ocasiones', 'categorias', 'presentaciones', 'gamas'] },
  /**
   * DOS grupos, no uno. Lo señaló el dueño cuando "Ventas y créditos" llegó a
   * ocho pestañas: *"una cosa es la parte contable —lo que se vende, lo que
   * sale, lo que se devuelve— y otra muy diferente las fórmulas y demás, que no
   * es el core de las ventas sino más de operaciones o de reglas"*.
   *
   * Y tenía razón: mezclaba PLATA (ventas, créditos, devoluciones, lo que se le
   * paga al proveedor) con OPERACIÓN (qué tengo, qué armé, con qué receta,
   * cuánto me cuesta, qué pedir). Se busca con cabezas distintas.
   */
  { id: 'negocio', label: 'Ventas y créditos', tabs: ['ventas', 'creditos', 'devoluciones', 'pagos'] },
  /**
   * Las RECETAS y el costo de producción viven aquí, no en Mayoreo: de ellas
   * salen los materiales que descuenta cada venta y cada lote, así que las usa
   * todo el negocio. Mayoreo solo cotiza, y para eso las lee.
   */
  { id: 'operacion', label: 'Producción e inventario', tabs: ['inventario', 'reposicion', 'producciones', 'formulas', 'costos'] },
  { id: 'mayoreo', label: 'Mayoreo B2B', tabs: ['cotizaciones'] },
  { id: 'reportes', label: 'Reportes', tabs: ['rep_ventas', 'rep_compras', 'rep_clientes'] },
  { id: 'cuentas', label: 'Personas y página', tabs: ['usuarios', 'publicidad', 'recompensas', 'resenas', 'avisos', 'nosotros', 'blog', 'redes'] },
];

const sectionOfTab = (tab: Tab) =>
  NAV_SECTIONS.find(s => s.tabs.includes(tab))?.id ?? NAV_SECTIONS[0].id;

const TAB_POR_DEFECTO: Tab = 'perfumes';
const esTabValido = (t?: string): t is Tab => !!t && Object.prototype.hasOwnProperty.call(TAB_META, t);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthContext();
  const guardedFetch = useGuardedFetch();

  // La pestaña vive en la URL (/dashboard/ventas): al recargar o usar el botón
  // "atrás" del navegador se conserva dónde estabas.
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const tab: Tab = esTabValido(tabParam) ? tabParam : TAB_POR_DEFECTO;
  useSeo(`${TAB_META[tab].label} — Dashboard`);

  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Secciones desplegadas del menú; la de la pestaña activa arranca abierta
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set([sectionOfTab(tab)]));
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

  // /dashboard (o una pestaña inexistente en la URL) → pestaña por defecto.
  // `replace` para no ensuciar el historial del navegador.
  useEffect(() => {
    if (!esTabValido(tabParam)) navigate(`/dashboard/${TAB_POR_DEFECTO}`, { replace: true });
  }, [tabParam, navigate]);

  const loadLookups = async () => {
    const [aRes, oRes, cRes, pRes] = await Promise.all([
      fetch(`${API}/tipos-aroma`), fetch(`${API}/ocasiones`), fetch(`${API}/categorias`), fetch(`${API}/presentaciones`),
    ]);
    const [a, o, c, p] = await Promise.all([aRes.json(), oRes.json(), cRes.json(), pRes.json()]);
    setAromas(a.data ?? []); setOcasiones(o.data ?? []); setCategorias(c.data ?? []); setPresentaciones(p.data ?? []);
  };

  const loadPerfumes = async (page = perfumesPage, size = perfumesPageSize, search = perfumesSearch) => {
    const searchQs = search ? `&search=${encodeURIComponent(search)}` : '';
    // `todos=1`: el dashboard ve TAMBIÉN los que están fuera de la tienda; si no,
    // no habría forma de devolverlos. El servidor solo lo acepta si eres admin.
    const res = await guardedFetch(`${API}/?page=${page}&limit=${size}${searchQs}&todos=1`);
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
      guardedFetch(`${API}/?page=1&limit=${DEFAULT_PAGE_SIZE}&todos=1`).then(r => r.json()),
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
    navigate(`/dashboard/${t}`);
    setDrawerOpen(false);
  };

  /**
   * Reacciona al cambio de pestaña venga de donde venga (clic en el menú o
   * botón atrás/adelante del navegador). En el primer render no recarga: los
   * datos ya los trae el efecto de carga inicial.
   */
  const primerRender = useRef(true);
  useEffect(() => {
    setOpenSections(prev => new Set(prev).add(sectionOfTab(tab)));
    if (primerRender.current) { primerRender.current = false; return; }
    if (tab === 'perfumes') loadPerfumes(1);
    if (tab === 'combos') loadCombos(1);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => { logout(); navigate('/login'); };

  // Devuelven { ok, error } para que la pestaña pueda avisar cuando el backend
  // rechaza (nombre repetido, elemento en uso). Antes se ignoraba la respuesta
  // y el fallo era invisible: el elemento no se agregaba y nadie sabía por qué.
  /**
   * Envoltorio de las mutaciones de clasificación. El try/catch NO es adorno:
   * sin conexión, `guardedFetch` lanza y la excepción se comía el aviso, así que
   * el fallo volvía a ser invisible — justo lo que se estaba corrigiendo.
   */
  const mutarLookup = async (
    peticion: () => Promise<Response>,
    fallback: string,
  ): Promise<ResultadoLookup> => {
    try {
      const res = await peticion();
      const json = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: json?.error ?? fallback };
      refreshAll();
      // El id vuelve al crear: sirve para elegir de una lo recién creado
      return { ok: true, id: json?.data?.id };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor' };
    }
  };

  const handleLookupAdd = (endpoint: string) => (name: string) =>
    mutarLookup(
      () => guardedFetch(`${API}/${endpoint}`, { method: 'POST', body: JSON.stringify({ nombre: name }) }),
      'No se pudo guardar',
    );

  const handleLookupDelete = (endpoint: string, aviso: string) => async (id: number): Promise<ResultadoLookup> => {
    // Cancelar no es un error: se responde ok para que no salte ningún aviso.
    if (!window.confirm(aviso)) return { ok: true };
    return mutarLookup(
      () => guardedFetch(`${API}/${endpoint}/${id}`, { method: 'DELETE' }),
      'No se pudo eliminar',
    );
  };

  /**
   * Borra una categoría mudando antes sus perfumes. Es obligatorio: la FK es
   * SET NULL, así que sin destino quedarían sin categoría y su precio caería
   * al de respaldo (el de la lista sale de categoría × talla).
   */
  const moverYEliminarCategoria = (id: number, destinoId: number) =>
    mutarLookup(
      () => guardedFetch(`${API}/categorias/${id}?mover_a=${destinoId}`, { method: 'DELETE' }),
      'No se pudo eliminar',
    );

  const handleLookupEdit = (endpoint: string) => (id: number, name: string) =>
    mutarLookup(
      () => guardedFetch(`${API}/${endpoint}/${id}`, { method: 'PATCH', body: JSON.stringify({ nombre: name }) }),
      'No se pudo guardar',
    );

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

        <div className="flex items-center gap-1.5">
          {/* Respaldo de la base: visible en todos los tamaños */}
          <BackupSeguridad guardedFetch={guardedFetch} />
          {/* En celular estas acciones viven dentro del drawer */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/catalog">Ver catalogo</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Salir
            </Button>
          </div>
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
              <LookupTab title="Tipos de Aroma" nuevo="Nuevo aroma" editar="Editar aroma"
                ejemplo="Ej: Amaderado, Cítrico, Oriental" items={aromas}
                onAdd={handleLookupAdd('tipos-aroma')} onDelete={handleLookupDelete('tipos-aroma', '¿Eliminar este aroma? Los perfumes que lo tengan simplemente dejarán de mostrarlo.')} onEdit={handleLookupEdit('tipos-aroma')}
                importEntity="aromas" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'ocasiones' && (
              <LookupTab title="Ocasiones" nuevo="Nueva ocasión" editar="Editar ocasión"
                ejemplo="Ej: Diario, Noche, Oficina" items={ocasiones}
                onAdd={handleLookupAdd('ocasiones')} onDelete={handleLookupDelete('ocasiones', '¿Eliminar esta ocasión? Los perfumes que la tengan simplemente dejarán de mostrarla.')} onEdit={handleLookupEdit('ocasiones')}
                importEntity="ocasiones" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'categorias' && (
              <LookupTab title="Categorias" nuevo="Nueva categoría" editar="Editar categoría"
                ejemplo="Ej: Árabes, Diseñador, Nicho" items={categorias}
                mudanza={{
                  etiqueta: { uno: 'perfume', varios: 'perfumes' },
                  advertencia: 'Esos productos pasarán a costar lo que diga la lista de precios de la categoría que elijas.',
                  onMoverYEliminar: moverYEliminarCategoria,
                }}
                onAdd={handleLookupAdd('categorias')} onDelete={handleLookupDelete('categorias', '¿Eliminar esta categoría? OJO: los perfumes que la usan quedarán SIN categoría, y como el precio sale de la lista categoría × talla, pasarán a costar su precio de respaldo. Esto puede cambiar el precio de muchos productos de una vez.')} onEdit={handleLookupEdit('categorias')}
                importEntity="categorias" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'presentaciones' && (
              <LookupTab title="Presentaciones" nuevo="Nueva presentación" editar="Editar presentación"
                ejemplo="Ej: 30ML, 50 ml, 100 ml" items={presentaciones}
                onAdd={handleLookupAdd('presentaciones')} onDelete={handleLookupDelete('presentaciones', '¿Eliminar esta talla? Los perfumes que la ofrezcan dejarán de tenerla, junto con su precio para esa talla.')} onEdit={handleLookupEdit('presentaciones')}
                importEntity="presentaciones" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'gamas' && <GamasTab guardedFetch={guardedFetch} />}
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
            {tab === 'precios' && (
              <PreciosTab
                guardedFetch={guardedFetch} categorias={categorias}
                presentaciones={presentaciones} onMutate={refreshAll}
              />
            )}
            {tab === 'descuentos' && (
              <DescuentosTab guardedFetch={guardedFetch} onMutate={refreshAll} />
            )}
            {tab === 'ventas' && <VentasTab guardedFetch={guardedFetch} />}
            {tab === 'creditos' && <CreditosTab guardedFetch={guardedFetch} />}
            {tab === 'rep_ventas' && <ReportesVentasTab guardedFetch={guardedFetch} />}
            {tab === 'rep_compras' && <ReportesComprasTab guardedFetch={guardedFetch} />}
            {tab === 'rep_clientes' && <ReportesClientesTab guardedFetch={guardedFetch} />}
            {tab === 'pagos' && <PagosTab guardedFetch={guardedFetch} />}
            {tab === 'usuarios' && <UsuariosTab guardedFetch={guardedFetch} />}
            {tab === 'publicidad' && <PublicidadTab guardedFetch={guardedFetch} categorias={categorias} />}
            {tab === 'recompensas' && <RecompensasTab guardedFetch={guardedFetch} />}
            {tab === 'resenas' && <ResenasTab guardedFetch={guardedFetch} />}
            {tab === 'avisos' && <AvisosTab guardedFetch={guardedFetch} />}
            {tab === 'nosotros' && <SobreNosotrosTab guardedFetch={guardedFetch} />}
            {tab === 'blog' && <BlogTab guardedFetch={guardedFetch} />}
            {tab === 'cotizaciones' && <CotizacionesTab guardedFetch={guardedFetch} />}
            {tab === 'formulas' && <FormulasVolumenTab guardedFetch={guardedFetch} />}
            {tab === 'costos' && <CostosProduccionTab guardedFetch={guardedFetch} />}
            {tab === 'devoluciones' && <DevolucionesTab guardedFetch={guardedFetch} />}
            {tab === 'inventario' && <InventarioTab guardedFetch={guardedFetch} />}
            {tab === 'reposicion' && <ReposicionTab guardedFetch={guardedFetch} />}
            {tab === 'producciones' && <ProduccionesTab guardedFetch={guardedFetch} />}
            {tab === 'redes' && <RedesTab guardedFetch={guardedFetch} />}
          </>
        )}
      </main>
    </div>
  );
}
