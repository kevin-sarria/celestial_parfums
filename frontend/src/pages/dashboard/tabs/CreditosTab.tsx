import { useEffect, useState } from 'react';
import { CircleDollarSign, Gauge, History, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import type { FiltersState } from '../../../components/table/tableTypes';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import PerfilCreditoModal from './PerfilCreditoModal';
import { CreditoForm } from './CreditoForm';
import { AbonoModal } from './AbonoModal';
import { PagosCreditoModal } from './PagosCreditoModal';
import { creditosColumns } from '../columns';
import { DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { EncabezadoPagina, FranjaMetricas, Section, StatCard } from '../ui';
import type { Credito, PerfilCredito, Usuario } from '../types';
import { useAuthContext } from '../../../application/context/useAuthContext';
import { PedirBorrado } from '../pedido/PedirBorrado';

interface TotalesCartera {
  total_en_deuda: number;
  clientes_con_deuda: number;
  vencido: number;
  creditos_vencidos: number;
  abonado_mes: number;
}

export function CreditosTab() {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<TotalesCartera | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtros, setFiltros] = useState<FiltersState>({});
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [modal, setModal] = useState<{ open: boolean; credito: Credito | null }>({ open: false, credito: null });
  const [importOpen, setImportOpen] = useState(false);

  /** El crédito al que se le está abonando; null = modal cerrado. */
  const [abonando, setAbonando] = useState<Credito | null>(null);
  /** El crédito cuyo historial de pagos está abierto; null = cerrado. */
  const [viendoPagos, setViendoPagos] = useState<Credito | null>(null);

  const [perfil, setPerfil] = useState<PerfilCredito | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilUsuario, setPerfilUsuario] = useState<Usuario | null>(null);
  const [cupoEdit, setCupoEdit] = useState('');
  const [cupoSaving, setCupoSaving] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [catalogo, setCatalogo] = useState<Perfume[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  const load = async (p = page, s = pageSize, term = searchTerm, filtrosActuales = filtros) => {
    setCargando(true);
    try {
      // Lista y totales en un solo viaje (ver `urls.creditos.totales`).
      const cRes = await http.get<{ data: Credito[]; total: number; totales?: TotalesCartera }>(
        urls.creditos.lista,
        {
          params: {
            page: p, limit: s, con_totales: 1,
            ...(term ? { search: term } : {}),
            ...(Object.keys(filtrosActuales).length ? { filtros: JSON.stringify(filtrosActuales) } : {}),
          },
        },
      );
      if (!cRes.ok) throw new Error(cRes.error);
      setCreditos(cRes.cuerpo?.data ?? []);
      setTotal(cRes.cuerpo?.total ?? 0);
      setPage(p);
      setFiltros(filtrosActuales);
      setSearchTerm(term); // con la búsqueda: "Limpiar todo" no debe revivir en la siguiente recarga
      setTotales(cRes.cuerpo?.totales ?? null);
      setErrorCarga('');
    } catch {
      // Sin esto la pantalla se queda vacía y parece que no hay créditos
      setErrorCarga('No se pudieron cargar los créditos. Revisa tu conexión y reintenta.');
    } finally { setCargando(false); }
  };

  /**
   * `refrescar` se usa cuando la pantalla ACABA de crear una persona o un
   * producto: la lista guardada ya no los tiene, y sin olvidarla el recién
   * creado no aparecería hasta que caduque la caché.
   */
  const loadCatalogos = async (refrescar = false) => {
    if (refrescar) {
      [urls.usuarios.lista, urls.perfumes.todosConOcultos, urls.combos.todos].forEach(http.olvidar);
    }
    try {
      // Mismos catálogos que Ventas: con caché se traen una vez por sesión y
      // cambiar entre las dos pantallas deja de pedirlos otra vez.
      const [uRes, pRes, coRes] = await Promise.all([
        http.getCacheado<{ data: Usuario[] }>(urls.usuarios.lista),
        http.getCacheado<{ data: { data: Perfume[] } | Perfume[] }>(urls.perfumes.todosConOcultos),
        http.getCacheado<{ data: Combo[] }>(urls.combos.todos),
      ]);
      setUsuarios((uRes.cuerpo?.data ?? []).filter((x) => x.rol_id !== 1));
      // /api/parfums sin paginar responde { data: { data: [...] } }
      const pf = pRes.cuerpo?.data;
      const lista = Array.isArray(pf) ? pf : (pf?.data ?? []);
      setCatalogo([...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setCombos((coRes.cuerpo?.data ?? []).filter(c => c.activo));
    } catch { /* el formulario avisa si falta el catálogo */ }
  };

  useEffect(() => { load(1); loadCatalogos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Perfil crediticio interno (cupo, comportamiento, veto) ────────────────
  const openPerfil = async (userId: number) => {
    setPerfilOpen(true); setPerfil(null);
    setPerfilUsuario(usuarios.find(u => u.id === userId) ?? null);
    try {
      const res = await http.get<{ data: PerfilCredito }>(urls.usuarios.perfilCredito(userId));
      if (res.ok && res.cuerpo) {
        setPerfil(res.cuerpo.data);
        setCupoEdit(String(res.cuerpo.data.cupo_base ?? 0));
      }
    } catch { /* el modal muestra el estado de carga */ }
  };

  const saveCupo = async () => {
    if (!perfil || !perfilUsuario) return;
    setCupoSaving(true);
    try {
      const res = await http.patch(urls.usuarios.usuario(perfil.user_id), {
        nombre: perfilUsuario.nombre, apellido: perfilUsuario.apellido,
        email: perfilUsuario.email,
        cupo_base: Number(cupoEdit) || 0,
      });
      if (res.ok) { await openPerfil(perfil.user_id); return; }
      toast.error(res.error, { id: 'creditos' });
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'creditos' }); }
    finally { setCupoSaving(false); }
  };

  /**
   * Un abono entró o se borró: el servidor ya devolvió el crédito como quedó,
   * así que se reemplaza esa fila y solo se piden los totales de la cartera,
   * que sí cambian y no vienen en la respuesta.
   */
  const alCambiarAbonos = async (actualizado: Credito) => {
    setCreditos(prev => prev.map(c => (c.id === actualizado.id ? actualizado : c)));
    setAbonando(prev => (prev ? actualizado : prev));
    setViendoPagos(prev => (prev ? actualizado : prev));
    try {
      const res = await http.get<{ data: TotalesCartera }>(urls.creditos.totales);
      if (res.ok && res.cuerpo) setTotales(res.cuerpo.data);
    } catch { /* los totales se ponen al día en la próxima carga */ }
  };

  const handleDelete = async (c: Credito) => {
    if (!window.confirm('¿Eliminar este crédito? Se borra también su venta enlazada y, si usó cupón, ese código vuelve a quedar activo.')) return;
    try {
      const res = await http.borrar(urls.creditos.credito(c.id));
      if (!res.ok) { toast.error(res.error, { id: 'creditos' }); return; }
      load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'creditos' }); }
  };

  // El personal ve solo lo que su rol permite (el servidor lo exige igual).
  // Sin permiso de borrar, el botón PIDE el borrado al dueño.
  const { isAdmin, puede } = useAuthContext();
  const [pedirBorrar, setPedirBorrar] = useState<Credito | null>(null);

  const acciones = (c: Credito, conTexto: boolean) => (
    <>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-primary'}
        title="Perfil crediticio (cupo y comportamiento)"
        onClick={() => openPerfil(c.cliente.id)}
      >
        <Gauge className="size-4" />{conTexto && ' Perfil'}
      </Button>
      {puede('creditos.abonar') && (
        <Button
          variant={conTexto ? 'outline' : 'ghost'}
          size={conTexto ? 'sm' : 'icon'}
          className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-primary'}
          title="Registrar abono"
          onClick={() => setAbonando(c)}
        >
          <CircleDollarSign className="size-4" />{conTexto && ' Abonar'}
        </Button>
      )}
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-primary'}
        title="Historial de pagos"
        onClick={() => setViendoPagos(c)}
      >
        <History className="size-4" />{conTexto && ' Pagos'}
      </Button>
      {puede('creditos.registrar') && (
        <Button
          variant={conTexto ? 'outline' : 'ghost'}
          size={conTexto ? 'sm' : 'icon'}
          className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
          title="Editar crédito"
          onClick={() => setModal({ open: true, credito: c })}
        >
          <Pencil className="size-4" />{conTexto && ' Editar'}
        </Button>
      )}
      {puede('creditos.borrar', 'creditos.registrar') && (
        <Button
          variant={conTexto ? 'outline' : 'ghost'}
          size={conTexto ? 'sm' : 'icon'}
          className={conTexto ? 'text-destructive' : 'size-8 text-muted-foreground hover:text-destructive'}
          onClick={() => (puede('creditos.borrar') ? handleDelete(c) : setPedirBorrar(c))}
          title={puede('creditos.borrar') ? 'Eliminar' : 'Pedir al dueño que lo borre'}
        >
          <Trash2 className="size-4" />{conTexto && ' Borrar'}
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Créditos" count={total} />

      {totales && (
        <FranjaMetricas>
          <StatCard
            label="Te deben hoy"
            value={formatPrice(totales.total_en_deuda)}
            nota={totales.clientes_con_deuda === 1
              ? 'De 1 cliente'
              : `De ${totales.clientes_con_deuda} clientes`}
          />
          <StatCard
            label="Vencido"
            value={formatPrice(totales.vencido)}
            nota={totales.creditos_vencidos === 0
              ? 'Ningún crédito pasado de fecha'
              : totales.creditos_vencidos === 1
                ? '1 crédito pasado de la fecha pactada'
                : `${totales.creditos_vencidos} créditos pasados de la fecha pactada`}
          />
          <StatCard
            label="Abonado este mes"
            value={formatPrice(totales.abonado_mes)}
            nota="Lo que te han pagado de sus deudas"
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
            columns={creditosColumns}
            rows={creditos}
            rowKey={c => c.id}
            numerada
            tarjetaMovil
            emptyText={cargando ? 'Cargando…' : 'Sin créditos registrados'}
            onServerSearch={t => load(1, pageSize, t)}
            onServerFilter={f => load(1, pageSize, searchTerm, f)}
            onServerClearAll={() => load(1, pageSize, '', {})}
            pagination={{
              page, totalRows: total, pageSize,
              onPageChange: p => load(p, pageSize),
              onPageSizeChange: s => { setPageSize(s); load(1, s); },
            }}
            renderActions={c => acciones(c, false)}
            accionesMovil={c => acciones(c, true)}
            acciones={
              <>
                {/* Exportar e importar son del dueño */}
                {isAdmin && (
                  <>
                    <ExportButton entity="creditos" />
                    <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                      <Upload className="size-4" /> Importar
                    </Button>
                  </>
                )}
                {puede('creditos.registrar') && (
                  <Button size="sm" onClick={() => setModal({ open: true, credito: null })}>
                    + Nuevo crédito
                  </Button>
                )}
              </>
            }
          />
        )}
      </Section>

      <PedirBorrado
        que={pedirBorrar ? `el crédito #${pedirBorrar.id} de ${pedirBorrar.cliente.nombre}` : null}
        url={pedirBorrar ? urls.solicitudes.borrarCredito(pedirBorrar.id) : ''}
        onCerrar={() => setPedirBorrar(null)}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="creditos"
        onImported={() => load(1)}
      />

      <CreditoForm
        open={modal.open}
        credito={modal.credito}
        usuarios={usuarios}
        catalogo={catalogo}
        combos={combos}
        onClose={() => setModal({ open: false, credito: null })}
        onSaved={creoPersona => {
          setModal({ open: false, credito: null });
          load();
          if (creoPersona) loadCatalogos(true);
        }}
      />

      <AbonoModal
        credito={abonando}
        onClose={() => setAbonando(null)}
        onCambio={alCambiarAbonos}
      />

      <PagosCreditoModal
        credito={viendoPagos}
        onClose={() => setViendoPagos(null)}
        onCambio={alCambiarAbonos}
      />

      <PerfilCreditoModal
        open={perfilOpen}
        onClose={() => setPerfilOpen(false)}
        perfil={perfil}
        cupoEdit={cupoEdit}
        onCupoEdit={setCupoEdit}
        onGuardarCupo={saveCupo}
        guardando={cupoSaving}
      />
    </div>
  );
}
