import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import { useAuthContext } from '../../application/context/useAuthContext';
import { useGuardedFetch } from './useGuardedFetch';
import { useSeo } from '../../application/hooks/useSeo';
import { DEFAULT_PAGE_SIZE, conNotaDeTalla } from './helpers';
import { http, type Respuesta } from '../../infrastructure/api/http';
import { urls, type Clasificacion } from '../../infrastructure/api/urls';
import type { Tab, Lookup } from './types';
import { MenuLateral } from './MenuLateral';
import { TAB_META, TAB_POR_DEFECTO, esTabValido } from './navegacion';
import CentroNotificaciones from './CentroNotificaciones';
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

  const loadPerfumes = async (page = perfumesPage, size = perfumesPageSize, search = perfumesSearch) => {
    // `todos=1`: el dashboard ve TAMBIÉN los que están fuera de la tienda; si no,
    // no habría forma de devolverlos. El servidor solo lo acepta si eres admin.
    const res = await http.get<{ data: Perfume[]; total: number }>(urls.perfumes.todos, {
      params: { page, limit: size, todos: 1, ...(search ? { search } : {}) },
    });
    setPerfumes(res.cuerpo?.data ?? []);
    setPerfumesTotal(res.cuerpo?.total ?? 0);
    setPerfumesPage(page);
  };

  const loadCombos = async (page = combosPage, size = combosPageSize, search = combosSearch) => {
    const res = await http.get<{ data: Combo[]; total: number }>(urls.combos.lista, {
      params: { page, limit: size, ...(search ? { search } : {}) },
    });
    setCombos(res.cuerpo?.data ?? []);
    setCombosTotal(res.cuerpo?.total ?? 0);
    setCombosPage(page);
  };

  const refreshAll = () => { loadLookups(); loadPerfumes(); loadCombos(); };

  /**
   * Carga inicial. Llama a las MISMAS funciones que usa el resto de la
   * pantalla, en vez de repetir las peticiones a mano: antes eran dos copias de
   * lo mismo, y la que se olvidara de actualizar quedaba mintiendo.
   */
  useEffect(() => {
    Promise.all([loadLookups(), loadPerfumes(1), loadCombos(1)])
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
          {/* Lo único que queda a la derecha en pantalla pequeña: lo que está
              pendiente. El respaldo se movió al menú lateral porque los dos
              juntos truncaban el nombre de la tienda. */}
          <CentroNotificaciones guardedFetch={guardedFetch} />
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
                ejemplo="Escribe el tamaño DELANTE: 30ML, 90 ML, 125 ml. De ahí sale el número con el que el sistema la costea y le enlaza su receta."
                items={presentaciones}
                onAdd={handleLookupAdd('presentaciones')} onDelete={handleLookupDelete('presentaciones', '¿Eliminar esta talla? Los perfumes que la ofrezcan dejarán de tenerla, junto con su precio para esa talla.')} onEdit={handleLookupEdit('presentaciones')}
                importEntity="presentaciones" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'gamas' && <GamasTab />}
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
            {tab === 'rep_ventas' && <ReportesVentasTab />}
            {tab === 'rep_compras' && <ReportesComprasTab />}
            {tab === 'rep_clientes' && <ReportesClientesTab />}
            {tab === 'pagos' && <PagosTab guardedFetch={guardedFetch} />}
            {tab === 'usuarios' && <UsuariosTab />}
            {tab === 'publicidad' && <PublicidadTab guardedFetch={guardedFetch} categorias={categorias} />}
            {tab === 'recompensas' && <RecompensasTab guardedFetch={guardedFetch} />}
            {tab === 'resenas' && <ResenasTab guardedFetch={guardedFetch} />}
            {tab === 'avisos' && <AvisosTab />}
            {tab === 'nosotros' && <SobreNosotrosTab />}
            {tab === 'blog' && <BlogTab />}
            {tab === 'cotizaciones' && <CotizacionesTab guardedFetch={guardedFetch} />}
            {tab === 'formulas' && <FormulasVolumenTab guardedFetch={guardedFetch} />}
            {tab === 'costos' && <CostosProduccionTab guardedFetch={guardedFetch} />}
            {tab === 'devoluciones' && <DevolucionesTab guardedFetch={guardedFetch} />}
            {tab === 'inventario' && <InventarioTab guardedFetch={guardedFetch} />}
            {tab === 'reposicion' && <ReposicionTab />}
            {tab === 'producciones' && <ProduccionesTab guardedFetch={guardedFetch} />}
            {tab === 'redes' && <RedesTab />}
          </>
        )}
      </main>
    </div>
  );
}
