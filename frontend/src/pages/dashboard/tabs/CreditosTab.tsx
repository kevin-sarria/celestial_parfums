import { useEffect, useState } from 'react';
import { CircleDollarSign, Gauge, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import PerfilCreditoModal from './PerfilCreditoModal';
import { CreditoForm } from './CreditoForm';
import { creditosColumns } from '../columns';
import { DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { EncabezadoPagina, Field, FranjaMetricas, Section, StatCard } from '../ui';
import type { GuardedFetch, Credito, PerfilCredito, Usuario } from '../types';

interface CreditosTabProps {
  guardedFetch: GuardedFetch;
}

interface TotalesCartera {
  total_en_deuda: number;
  clientes_con_deuda: number;
  vencido: number;
  creditos_vencidos: number;
  abonado_mes: number;
}

export function CreditosTab({ guardedFetch }: CreditosTabProps) {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<TotalesCartera | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [modal, setModal] = useState<{ open: boolean; credito: Credito | null }>({ open: false, credito: null });
  const [importOpen, setImportOpen] = useState(false);

  const [abonoModal, setAbonoModal] = useState<{ open: boolean; creditoId: number | null }>({ open: false, creditoId: null });
  const [abonoMonto, setAbonoMonto] = useState('');

  const [perfil, setPerfil] = useState<PerfilCredito | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilUsuario, setPerfilUsuario] = useState<Usuario | null>(null);
  const [cupoEdit, setCupoEdit] = useState('');
  const [cupoSaving, setCupoSaving] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [catalogo, setCatalogo] = useState<Perfume[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  const load = async (p = page, s = pageSize, term = searchTerm) => {
    setCargando(true);
    try {
      const [cRes, tRes] = await Promise.all([
        http.get<{ data: Credito[]; total: number }>(urls.creditos.lista, {
          params: { page: p, limit: s, ...(term ? { search: term } : {}) },
        }),
        http.get<{ data: TotalesCartera }>(urls.creditos.totales),
      ]);
      if (!cRes.ok || !tRes.ok) throw new Error(cRes.error || tRes.error);
      setCreditos(cRes.cuerpo?.data ?? []);
      setTotal(cRes.cuerpo?.total ?? 0);
      setPage(p);
      setTotales(tRes.cuerpo?.data ?? null);
      setErrorCarga('');
    } catch {
      // Sin esto la pantalla se queda vacía y parece que no hay créditos
      setErrorCarga('No se pudieron cargar los créditos. Revisa tu conexión y reintenta.');
    } finally { setCargando(false); }
  };

  const loadCatalogos = async () => {
    try {
      const [uRes, pRes, coRes] = await Promise.all([
        http.get<{ data: Usuario[] }>(urls.usuarios.lista),
        http.get<{ data: { data: Perfume[] } | Perfume[] }>(urls.perfumes.todos),
        http.get<{ data: Combo[] }>(urls.combos.todos),
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

  const handleAbono = async () => {
    if (!abonoModal.creditoId || !abonoMonto) return;
    try {
      const res = await http.patch(urls.creditos.abono(abonoModal.creditoId), {
        monto: Number(abonoMonto),
      });
      if (!res.ok) { toast.error(res.error, { id: 'creditos' }); return; }
      toast.success(`Abono de ${formatPrice(Number(abonoMonto))} registrado`);
      setAbonoModal({ open: false, creditoId: null }); setAbonoMonto(''); load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'creditos' }); }
  };

  const handleDelete = async (c: Credito) => {
    if (!window.confirm('¿Eliminar este crédito? Se borra también su venta enlazada y, si usó cupón, ese código vuelve a quedar activo.')) return;
    try {
      const res = await http.borrar(urls.creditos.credito(c.id));
      if (!res.ok) { toast.error(res.error, { id: 'creditos' }); return; }
      load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'creditos' }); }
  };

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
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-primary'}
        title="Registrar abono"
        onClick={() => { setAbonoModal({ open: true, creditoId: c.id }); setAbonoMonto(''); }}
      >
        <CircleDollarSign className="size-4" />{conTexto && ' Abonar'}
      </Button>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
        title="Editar crédito"
        onClick={() => setModal({ open: true, credito: c })}
      >
        <Pencil className="size-4" />{conTexto && ' Editar'}
      </Button>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? 'text-destructive' : 'size-8 text-muted-foreground hover:text-destructive'}
        onClick={() => handleDelete(c)}
        title="Eliminar"
      >
        <Trash2 className="size-4" />{conTexto && ' Borrar'}
      </Button>
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
            onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
            pagination={{
              page, totalRows: total, pageSize,
              onPageChange: p => load(p, pageSize),
              onPageSizeChange: s => { setPageSize(s); load(1, s); },
            }}
            renderActions={c => acciones(c, false)}
            accionesMovil={c => acciones(c, true)}
            acciones={
              <>
                <ExportButton entity="creditos" guardedFetch={guardedFetch} />
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" /> Importar
                </Button>
                <Button size="sm" onClick={() => setModal({ open: true, credito: null })}>
                  + Nuevo crédito
                </Button>
              </>
            }
          />
        )}
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="creditos"
        guardedFetch={guardedFetch}
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
          if (creoPersona) loadCatalogos();
        }}
      />

      <Modal
        open={abonoModal.open}
        onClose={() => setAbonoModal({ open: false, creditoId: null })}
        title="Registrar abono"
        maxWidth={360}
        footer={
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAbonoModal({ open: false, creditoId: null })}>
              Cancelar
            </Button>
            <Button onClick={handleAbono} disabled={!abonoMonto}>Guardar abono</Button>
          </DialogFooter>
        }
      >
        <Field label="Monto del abono (COP)">
          <Input type="number" min="1" value={abonoMonto}
            onChange={e => setAbonoMonto(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAbono()} />
        </Field>
      </Modal>

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
