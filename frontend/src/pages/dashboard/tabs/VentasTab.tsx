import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import { ventasColumns } from '../columns';
import { VentaForm } from './VentaForm';
import { DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { EncabezadoPagina, FranjaMetricas, Section, StatCard } from '../ui';
import type { Venta, Usuario } from '../types';

interface Totales {
  total_unidades: number;
  total_dinero: number;
  ingresos_mes: number;
  abonos_mes: number;
}

const MES = new Intl.DateTimeFormat('es-CO', { month: 'long' });

export function VentasTab() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [catalogo, setCatalogo] = useState<Perfume[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  const [modal, setModal] = useState<{ open: boolean; venta: Venta | null }>({ open: false, venta: null });
  const [importOpen, setImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  // Las ventas y sus totales cambian con cada acción; los catálogos, solo al montar
  const load = async (p = page, s = pageSize, term = searchTerm) => {
    setCargando(true);
    try {
      // Lista y totales viajan JUNTOS: la pantalla los pinta a la vez, y el
      // servidor resuelve las dos consultas en paralelo. Un viaje, no dos.
      const vRes = await http.get<{ data: Venta[]; total: number; totales?: Totales }>(
        urls.ventas.lista,
        { params: { page: p, limit: s, con_totales: 1, ...(term ? { search: term } : {}) } },
      );
      if (!vRes.ok) throw new Error(vRes.error);
      setVentas(vRes.cuerpo?.data ?? []);
      setTotal(vRes.cuerpo?.total ?? 0);
      setPage(p);
      setTotales(vRes.cuerpo?.totales ?? null);
      setErrorCarga('');
    } catch {
      // Sin esto la pantalla se queda vacía y parece que no hay ventas
      setErrorCarga('No se pudieron cargar las ventas. Revisa tu conexión y reintenta.');
    } finally { setCargando(false); }
  };

  /**
   * `refrescar` se usa cuando la pantalla ACABA de crear una persona o un
   * producto: la lista guardada ya no los tiene, y sin olvidarla el recién
   * creado no aparecería hasta que caduque la caché.
   */
  const loadCatalogos = async (refrescar = false) => {
    if (refrescar) {
      [urls.usuarios.lista, urls.perfumes.todos, urls.combos.todos].forEach(http.olvidar);
    }
    try {
      // Los catálogos del formulario (personas, productos, combos) apenas
      // cambian y los piden VARIAS pantallas. Con caché se traen una vez por
      // sesión en vez de en cada visita a Ventas, Créditos o al volver de otra
      // pestaña. Al crear una persona o un producto se refrescan (`recargar`).
      const [uRes, pRes, cRes] = await Promise.all([
        http.getCacheado<{ data: Usuario[] }>(urls.usuarios.lista),
        http.getCacheado<{ data: { data: Perfume[] } | Perfume[] }>(urls.perfumes.todos),
        http.getCacheado<{ data: Combo[] }>(urls.combos.todos),
      ]);
      setUsuarios((uRes.cuerpo?.data ?? []).filter((x) => x.rol_id !== 1));
      // /api/parfums sin paginar responde { data: { data: [...] } }
      const pf = pRes.cuerpo?.data;
      const lista = Array.isArray(pf) ? pf : (pf?.data ?? []);
      setCatalogo([...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setCombos((cRes.cuerpo?.data ?? []).filter(c => c.activo));
    } catch { /* el formulario avisa si falta el catálogo */ }
  };

  useEffect(() => { load(1); loadCatalogos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (v: Venta) => {
    if (!window.confirm('¿Eliminar esta venta? El inventario que salió con ella vuelve a entrar.')) return;
    try {
      const res = await http.borrar(urls.ventas.venta(v.id));
      if (!res.ok) { toast.error(res.error, { id: 'ventas' }); return; }
      load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'ventas' }); }
  };

  const [enlazando, setEnlazando] = useState(false);
  /** Reintenta la inferencia venta→perfumes de las ventas importadas sin enlazar. */
  const handleEnlazar = async () => {
    setEnlazando(true);
    try {
      const res = await http.post<{ message?: string }>(urls.ventas.enlazarPerfumes);
      if (!res.ok) { toast.error(res.error, { id: 'ventas' }); return; }
      toast.success(res.cuerpo?.message ?? 'Listo');
      load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'ventas' }); }
    finally { setEnlazando(false); }
  };

  const acciones = (v: Venta, conTexto: boolean) => (
    <>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
        onClick={() => setModal({ open: true, venta: v })}
        title="Editar"
      >
        <Pencil className="size-4" />{conTexto && ' Editar'}
      </Button>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? 'text-destructive' : 'size-8 text-muted-foreground hover:text-destructive'}
        onClick={() => handleDelete(v)}
        title="Eliminar"
      >
        <Trash2 className="size-4" />{conTexto && ' Borrar'}
      </Button>
    </>
  );

  const mesActual = MES.format(new Date());

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Ventas" count={total} />

      {totales && (
        <FranjaMetricas>
          <StatCard
            label={`Ingresos de ${mesActual}`}
            value={formatPrice(totales.ingresos_mes)}
            nota={totales.abonos_mes > 0
              ? `Incluye ${formatPrice(totales.abonos_mes)} de abonos a créditos`
              : 'Ventas de contado y abonos del mes'}
          />
          <StatCard
            label="Total en dinero"
            value={formatPrice(totales.total_dinero)}
            nota="Histórico, ya con las devoluciones restadas"
          />
          <StatCard
            label="Unidades vendidas"
            value={totales.total_unidades}
            nota={
              <Link to="/dashboard/rep_ventas" className="font-medium text-primary hover:underline">
                Ver cómo va el mes en Reportes
              </Link>
            }
          />
        </FranjaMetricas>
      )}

      <Section>
        {errorCarga ? (
          <div className="py-10 text-center">
            <p className="text-[13px] text-muted-foreground">{errorCarga}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>Reintentar</Button>
          </div>
        ) : (
          <SmartTable
            columns={ventasColumns}
            rows={ventas}
            rowKey={v => v.id}
            numerada
            tarjetaMovil
            emptyText={cargando ? 'Cargando…' : 'Sin ventas registradas'}
            onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
            pagination={{
              page, totalRows: total, pageSize,
              onPageChange: p => load(p, pageSize),
              onPageSizeChange: s => { setPageSize(s); load(1, s); },
            }}
            renderActions={v => acciones(v, false)}
            accionesMovil={v => acciones(v, true)}
            acciones={
              <>
                <ExportButton entity="ventas" />
                <Button
                  variant="outline" size="sm" disabled={enlazando}
                  title="Intenta enlazar por nombre las ventas importadas que aún no tienen producto del catálogo"
                  onClick={handleEnlazar}
                >
                  <Link2 className="size-4" /> {enlazando ? 'Enlazando…' : 'Enlazar perfumes'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" /> Importar
                </Button>
                <Button size="sm" onClick={() => setModal({ open: true, venta: null })}>
                  + Registrar venta
                </Button>
              </>
            }
          />
        )}
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="ventas"
        onImported={() => load(1)}
      />

      <VentaForm
        open={modal.open}
        venta={modal.venta}
        usuarios={usuarios}
        catalogo={catalogo}
        combos={combos}
        onClose={() => setModal({ open: false, venta: null })}
        onSaved={recargar => {
          setModal({ open: false, venta: null });
          load();
          if (recargar) loadCatalogos(true);
        }}
      />
    </div>
  );
}
