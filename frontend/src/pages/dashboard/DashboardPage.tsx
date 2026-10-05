import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import type { FiltersState } from '../../components/table/tableTypes';
import { useAuthContext } from '../../application/context/useAuthContext';
import { useSeo } from '../../application/hooks/useSeo';
import { DEFAULT_PAGE_SIZE, conNotaDeTalla } from './helpers';
import { http, type Respuesta } from '../../infrastructure/api/http';
import { urls, type Clasificacion } from '../../infrastructure/api/urls';
import type { Tab, Lookup } from './types';
import { MenuLateral } from './MenuLateral';
import { TAB_META, TAB_POR_DEFECTO, esClasificacion, esTabValido, primeraPermitida, tabPermitida, LINEAS_CATALOGO, PESTANAS_RENOMBRADAS } from './navegacion';
import { SelectorClasificaciones } from './SelectorClasificaciones';
import CentroNotificaciones from './CentroNotificaciones';
import BuscadorGeneral from './BuscadorGeneral';
import {
  LineaTab,
  CombosTab,
  PreciosTab,
  DescuentosTab,
  LookupTab,
  VentasTab,
  CreditosTab,
  InicioTab,
  RecompraTab,
  PagosTab,
  UsuariosTab,
  HistorialTab,
  RolesTab,
  SolicitudesTab,
  EmpaqueTab,
  PreciosOriginalesTab,
  PublicidadTab,
  RecompensasTab,
  ResenasTab,
  AvisosTab,
  SobreNosotrosTab,
  BlogTab,
  CotizacionesTab,
  FormulasVolumenTab,
  PreciosMayoreoTab,
  GamasTab,
  CostosProduccionTab,
  DevolucionesTab,
  InventarioTab,
  ReposicionTab,
  AlertasTab,
  ProduccionesTab,
  FrascosArmadosTab,
  ReportesVentasTab,
  ReportesComprasTab,
  ReportesClientesTab,
  RedesTab,
  MensajesTab,
} from './pestanas';
import type { ResultadoLookup } from './tabs/LookupTab';
import { AvisoAlertas } from './tabs/alertas/AvisoAlertas';
import PerfumeSpinner from '../../components/PerfumeSpinner';
import { BrandMark } from '../../components/BrandMark';
import type { LineaCatalogo } from './tabs/perfumes/tipoDeProducto';


/** Estado de UNA línea del catálogo (items + su paginación, búsqueda y filtros). */
interface EstadoLinea {
  items: Perfume[];
  page: number;
  total: number;
  pageSize: number;
  search: string;
  filtros: FiltersState;
}

const estadoVacio = (): EstadoLinea => ({
  items: [], page: 1, total: 0, pageSize: DEFAULT_PAGE_SIZE, search: '', filtros: {},
});

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAdmin, esPersonal, puede, logout } = useAuthContext();

  // La pestaña vive en la URL (/dashboard/ventas): al recargar o usar el botón
  // "atrás" del navegador se conserva dónde estabas.
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const tab: Tab = esTabValido(tabParam) ? tabParam : TAB_POR_DEFECTO;
  useSeo(`${TAB_META[tab].label} — Dashboard`);

  const [loading, setLoading] = useState(true);
  // Las 4 líneas del catálogo en UNA estructura: antes eran 12 useState y dos
  // funciones `load…` casi idénticas; con cuatro pestañas serían 24 estados.
  const [catalogo, setCatalogo] = useState<Record<LineaCatalogo, EstadoLinea>>(() => ({
    contratipo: estadoVacio(),
    uno_uno: estadoVacio(),
    original: estadoVacio(),
    producto: estadoVacio(),
  }));

  const [combos, setCombos] = useState<Combo[]>([]);
  const [combosPage, setCombosPage] = useState(1);
  const [combosTotal, setCombosTotal] = useState(0);
  const [combosPageSize, setCombosPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [combosSearch, setCombosSearch] = useState('');
  const [combosFiltros, setCombosFiltros] = useState<FiltersState>({});

  const [aromas, setAromas] = useState<Lookup[]>([]);
  const [ocasiones, setOcasiones] = useState<Lookup[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [presentaciones, setPresentaciones] = useState<Lookup[]>([]);

  // Entra el dueño y su personal (2026-10-04); un cliente, no
  useEffect(() => { if (!user || !esPersonal) navigate('/'); }, [user, esPersonal, navigate]);

  // /dashboard, una pestaña inexistente o una que su rol no abre → la primera
  // que sí. `replace` para no ensuciar el historial del navegador.
  useEffect(() => {
    // La pestaña que se llamaba Perfumes es hoy Contratipos (2026-10-04): un
    // enlace guardado no debe caer en Inicio sin explicación.
    const renombrada = tabParam ? PESTANAS_RENOMBRADAS[tabParam] : undefined;
    if (renombrada) { navigate(`/dashboard/${renombrada}${location.search}`, { replace: true }); return; }
    if (!esTabValido(tabParam) || !tabPermitida(tabParam, isAdmin, puede)) {
      navigate(`/dashboard/${primeraPermitida(isAdmin, puede)}`, { replace: true });
    }
  }, [tabParam, navigate, isAdmin, puede]);

  const loadLookups = async () => {
    const [aRes, oRes, cRes, pRes] = await Promise.all([
      http.get<{ data: Lookup[] }>(urls.clasificaciones('tipos-aroma').lista),
      http.get<{ data: Lookup[] }>(urls.clasificaciones('ocasiones').lista),
      http.get<{ data: Lookup[] }>(urls.clasificaciones('categorias').lista),
      http.get<{ data: Lookup[] }>(urls.clasificaciones('presentaciones').lista),
    ]);
    setAromas(aRes.cuerpo?.data ?? []);
    setOcasiones(oRes.cuerpo?.data ?? []);
    setCategorias(cRes.cuerpo?.data ?? []);
    setPresentaciones(conNotaDeTalla(pRes.cuerpo?.data ?? []));
  };

  const cargarLinea = async (
    linea: LineaCatalogo,
    page?: number, size?: number, search?: string, filtros?: FiltersState,
  ) => {
    const actual = catalogo[linea];
    const p = page ?? actual.page;
    const s = size ?? actual.pageSize;
    const q = search ?? actual.search;
    const f = filtros ?? actual.filtros;
    // `todos=1`: el dashboard ve TAMBIÉN los que están fuera de la tienda; si no,
    // no habría forma de devolverlos. El servidor solo lo acepta con `catalogo.ver`.
    const res = await http.get<{ data: Perfume[]; total: number }>(urls.perfumes.todos, {
      params: {
        page: p, limit: s, todos: 1, linea,
        ...(q ? { search: q } : {}),
        ...(Object.keys(f).length ? { filtros: JSON.stringify(f) } : {}),
      },
    });
    setCatalogo((prev) => ({
      ...prev,
      [linea]: { items: res.cuerpo?.data ?? [], total: res.cuerpo?.total ?? 0, page: p, pageSize: s, search: q, filtros: f },
    }));
  };

  const loadCombos = async (
    page = combosPage, size = combosPageSize, search = combosSearch, filtros = combosFiltros,
  ) => {
    const res = await http.get<{ data: Combo[]; total: number }>(urls.combos.lista, {
      params: {
        page, limit: size,
        ...(search ? { search } : {}),
        ...(Object.keys(filtros).length ? { filtros: JSON.stringify(filtros) } : {}),
      },
    });
    setCombos(res.cuerpo?.data ?? []);
    setCombosTotal(res.cuerpo?.total ?? 0);
    setCombosPage(page);
    setCombosFiltros(filtros);
    setCombosSearch(search); // con la búsqueda: "Limpiar todo" no debe revivir al recargar
  };

  const refreshAll = () => { loadLookups(); loadCombos(); LINEAS_CATALOGO.forEach(({ linea }) => cargarLinea(linea)); };

  /**
   * Carga inicial. Llama a las MISMAS funciones que usa el resto de la
   * pantalla, en vez de repetir las peticiones a mano: antes eran dos copias de
   * lo mismo, y la que se olvidara de actualizar quedaba mintiendo.
   */
  useEffect(() => {
    // El catálogo solo lo pide quien lo puede ver (el dueño, o el personal con la casilla)
    if (!puede('catalogo.ver')) { setLoading(false); return; }
    Promise.all([loadLookups(), loadCombos(1), ...LINEAS_CATALOGO.map(({ linea }) => cargarLinea(linea, 1))])
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Reacciona al cambio de pestaña venga de donde venga (clic en el menú o
   * botón atrás/adelante del navegador). En el primer render no recarga: los
   * datos ya los trae el efecto de carga inicial.
   */
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    const linea = LINEAS_CATALOGO.find(({ tab: t }) => t === tab)?.linea;
    if (linea) cargarLinea(linea, 1);
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
    peticion: () => Promise<Respuesta<{ data?: { id?: number } }>>,
  ): Promise<ResultadoLookup> => {
    const res = await peticion();
    if (!res.ok) return { ok: false, error: res.error };
    refreshAll();
    // El id vuelve al crear: sirve para elegir de una lo recién creado
    return { ok: true, id: res.cuerpo?.data?.id };
  };

  const handleLookupAdd = (endpoint: Clasificacion) => (name: string) =>
    mutarLookup(
      () => http.post(urls.clasificaciones(endpoint).crear, { nombre: name }),
    );

  const handleLookupDelete = (endpoint: Clasificacion, aviso: string) => async (id: number): Promise<ResultadoLookup> => {
    // Cancelar no es un error: se responde ok para que no salte ningún aviso.
    if (!window.confirm(aviso)) return { ok: true };
    return mutarLookup(
      () => http.borrar(urls.clasificaciones(endpoint).uno(id)),
    );
  };

  /**
   * Borra una categoría mudando antes sus perfumes. Es obligatorio: la FK es
   * SET NULL, así que sin destino quedarían sin categoría y su precio caería
   * al de respaldo (el de la lista sale de categoría × talla).
   */
  const moverYEliminarCategoria = (id: number, destinoId: number) =>
    mutarLookup(
      () => http.borrar(urls.clasificaciones('categorias').borrarMoviendo(id, destinoId)),
    );

  const handleLookupEdit = (endpoint: Clasificacion) => (id: number, name: string) =>
    mutarLookup(
      () => http.patch(urls.clasificaciones(endpoint).uno(id), { nombre: name }),
    );

  const ActiveIcon = TAB_META[tab].icon;

  return (
    <div className="dash-root flex h-svh flex-col bg-background">
      {/* ── Header: burger + marca a la izquierda, acciones a la derecha ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <MenuLateral />

          <span className="flex min-w-0 select-none items-center font-display text-[15.5px] font-medium tracking-wide text-foreground">
            <BrandMark className="mr-2 size-6 shrink-0" />
            <span className="truncate">Celestial Parfums</span>
            <span className="ml-2 hidden text-[11px] font-sans font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline">
              {isAdmin ? 'Admin' : 'Panel'}
            </span>
          </span>

          {/* Apartado activo */}
          <span className="hidden items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-semibold text-primary md:flex">
            <ActiveIcon className="size-3.5" />
            {TAB_META[tab].label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Lo único que queda a la derecha en pantalla pequeña: lo que está
              pendiente. El respaldo se movió al menú lateral porque los dos
              juntos truncaban el nombre de la tienda. */}
          {isAdmin && <BuscadorGeneral />}
          <CentroNotificaciones />
          {/* En celular estas acciones viven dentro del drawer */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link to={isAdmin ? '/catalog' : '/'}>Ver tienda</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </div>
      </header>


      {/* ── Contenido ── */}
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {/* El aviso de inventario va ARRIBA de todo y en cualquier pestaña: si
            solo saliera en Inventario, avisaría justo a quien ya está mirando el
            inventario. Es el sitio que pidió el dueño. */}
        {isAdmin && (
          <div className="mb-4 empty:mb-0">
            <AvisoAlertas recargarCon={tab} onVerPedido={() => navigate('/dashboard/reposicion')} />
          </div>
        )}
        {loading ? (
          <PerfumeSpinner />
        ) : (
          // Cada pestaña baja su propio archivo al abrirla (`pestanas.ts`)
          <Suspense fallback={<PerfumeSpinner />}>
            {LINEAS_CATALOGO.map(({ tab: tabId, linea }) => tab === tabId && (
              <LineaTab
                key={tabId}
                linea={linea}
                items={catalogo[linea].items}
                page={catalogo[linea].page}
                total={catalogo[linea].total}
                pageSize={catalogo[linea].pageSize}
                aromas={aromas} ocasiones={ocasiones} categorias={categorias} presentaciones={presentaciones}
                onPageChange={p => cargarLinea(linea, p)}
                onPageSizeChange={s => cargarLinea(linea, 1, s)}
                onSearch={t => cargarLinea(linea, 1, undefined, t)}
                onFilter={f => cargarLinea(linea, 1, undefined, undefined, f)}
                onClearAll={() => cargarLinea(linea, 1, undefined, '', {})}
                onMutate={refreshAll}
              />
            ))}
            {esClasificacion(tab) && <SelectorClasificaciones actual={tab} />}
            {tab === 'aromas' && (
              <LookupTab title="Tipos de Aroma" nuevo="Nuevo aroma" editar="Editar aroma"
                ejemplo="Ej: Amaderado, Cítrico, Oriental" items={aromas}
                onAdd={handleLookupAdd('tipos-aroma')} onDelete={handleLookupDelete('tipos-aroma', '¿Eliminar este aroma? Los perfumes que lo tengan simplemente dejarán de mostrarlo.')} onEdit={handleLookupEdit('tipos-aroma')}
                importEntity="aromas" onImported={refreshAll} />
            )}
            {tab === 'ocasiones' && (
              <LookupTab title="Ocasiones" nuevo="Nueva ocasión" editar="Editar ocasión"
                ejemplo="Ej: Diario, Noche, Oficina" items={ocasiones}
                onAdd={handleLookupAdd('ocasiones')} onDelete={handleLookupDelete('ocasiones', '¿Eliminar esta ocasión? Los perfumes que la tengan simplemente dejarán de mostrarla.')} onEdit={handleLookupEdit('ocasiones')}
                importEntity="ocasiones" onImported={refreshAll} />
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
                importEntity="categorias" onImported={refreshAll} />
            )}
            {tab === 'presentaciones' && (
              <LookupTab title="Presentaciones" nuevo="Nueva presentación" editar="Editar presentación"
                ejemplo="Escribe el tamaño DELANTE: 30ML, 90 ML, 125 ml. De ahí sale el número con el que el sistema la costea y le enlaza su receta."
                items={presentaciones}
                onAdd={handleLookupAdd('presentaciones')} onDelete={handleLookupDelete('presentaciones', '¿Eliminar esta talla? Los perfumes que la ofrezcan dejarán de tenerla, junto con su precio para esa talla.')} onEdit={handleLookupEdit('presentaciones')}
                importEntity="presentaciones" onImported={refreshAll} />
            )}
            {tab === 'gamas' && <GamasTab />}
            {tab === 'combos' && (
              <CombosTab
                combos={combos} page={combosPage} total={combosTotal} pageSize={combosPageSize}
                categorias={categorias} presentaciones={presentaciones}
                onPageChange={p => loadCombos(p, combosPageSize)}
                onPageSizeChange={s => { setCombosPageSize(s); loadCombos(1, s); }}
                onSearch={t => loadCombos(1, combosPageSize, t)}
                onFilter={f => loadCombos(1, combosPageSize, combosSearch, f)}
                onClearAll={() => loadCombos(1, combosPageSize, '', {})}
                onMutate={refreshAll}
              />
            )}
            {tab === 'precios' && (
              <PreciosTab categorias={categorias}
                presentaciones={presentaciones} onMutate={refreshAll}
              />
            )}
            {tab === 'descuentos' && (
              <DescuentosTab onMutate={refreshAll} />
            )}
            {tab === 'inicio' && <InicioTab />}
            {tab === 'ventas' && <VentasTab />}
            {tab === 'creditos' && <CreditosTab />}
            {tab === 'recompra' && <RecompraTab />}
            {tab === 'rep_ventas' && <ReportesVentasTab />}
            {tab === 'rep_compras' && <ReportesComprasTab />}
            {tab === 'rep_clientes' && <ReportesClientesTab />}
            {tab === 'pagos' && <PagosTab />}
            {tab === 'usuarios' && <UsuariosTab />}
            {tab === 'mensajes' && <MensajesTab />}
            {tab === 'historial' && <HistorialTab />}
            {tab === 'roles' && <RolesTab />}
            {tab === 'solicitudes' && <SolicitudesTab />}
            {tab === 'empaque' && <EmpaqueTab />}
            {tab === 'precios_originales' && <PreciosOriginalesTab />}
            {tab === 'publicidad' && <PublicidadTab categorias={categorias} />}
            {tab === 'recompensas' && <RecompensasTab />}
            {tab === 'resenas' && <ResenasTab />}
            {tab === 'avisos' && <AvisosTab />}
            {tab === 'nosotros' && <SobreNosotrosTab />}
            {tab === 'blog' && <BlogTab />}
            {tab === 'cotizaciones' && <CotizacionesTab />}
            {tab === 'formulas' && <FormulasVolumenTab />}
            {tab === 'precios_mayoreo' && <PreciosMayoreoTab />}
            {tab === 'costos' && <CostosProduccionTab />}
            {tab === 'devoluciones' && <DevolucionesTab />}
            {tab === 'inventario' && <InventarioTab />}
            {tab === 'armados' && <FrascosArmadosTab />}
            {tab === 'reposicion' && <ReposicionTab />}
            {tab === 'alertas' && <AlertasTab />}
            {tab === 'producciones' && <ProduccionesTab />}
            {tab === 'redes' && <RedesTab />}
          </Suspense>
        )}
      </main>
    </div>
  );
}
