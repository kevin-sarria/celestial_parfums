import { useEffect, useState } from 'react';
import { CircleDollarSign, Gauge, ShieldAlert, Trash2, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { creditosColumns } from '../columns';
import { API_CREDITOS, API_USUARIOS, DEFAULT_PAGE_SIZE, formatPrice, parseClienteSeleccion, personaLabel } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError } from '../ui';
import type { GuardedFetch, Credito, CreditoForm, PerfilCredito, Usuario } from '../types';
import { emptyCreditoForm } from '../types';

interface CreditosTabProps {
  guardedFetch: GuardedFetch;
}

export function CreditosTab({ guardedFetch }: CreditosTabProps) {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<CreditoForm>(emptyCreditoForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const [abonoModal, setAbonoModal] = useState<{ open: boolean; creditoId: number | null }>({ open: false, creditoId: null });
  const [abonoMonto, setAbonoMonto] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [perfil, setPerfil] = useState<PerfilCredito | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilUsuario, setPerfilUsuario] = useState<Usuario | null>(null);
  const [cupoEdit, setCupoEdit] = useState('');
  const [cupoSaving, setCupoSaving] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Los créditos cambian con cada acción; la lista de personas solo al montar
  const load = async (p = page, s = pageSize, term = searchTerm) => {
    const searchQs = term ? `&search=${encodeURIComponent(term)}` : '';
    const cRes = await guardedFetch(`${API_CREDITOS}?page=${p}&limit=${s}${searchQs}`);
    const cJson = await cRes.json();
    setCreditos(cJson.data ?? []);
    setTotal(cJson.total ?? 0);
    setPage(p);
  };

  const loadUsuarios = async () => {
    const uRes = await guardedFetch(API_USUARIOS);
    const uJson = await uRes.json();
    setUsuarios((uJson.data ?? []).filter((x: Usuario) => x.rol_id !== 1));
  };

  useEffect(() => { load(1); loadUsuarios(); }, []);

  // ── Perfil crediticio interno (cupo, comportamiento, veto) ────────────────
  const openPerfil = async (userId: number) => {
    setPerfilOpen(true); setPerfil(null);
    setPerfilUsuario(usuarios.find(u => u.id === userId) ?? null);
    try {
      const res = await guardedFetch(`${API_USUARIOS}/${userId}/perfil-credito`);
      const json = await res.json();
      if (res.ok) { setPerfil(json.data); setCupoEdit(String(json.data.cupo_base ?? 0)); }
    } catch { /* el modal muestra el estado de carga */ }
  };

  const saveCupo = async () => {
    if (!perfil || !perfilUsuario) return;
    setCupoSaving(true);
    try {
      const res = await guardedFetch(`${API_USUARIOS}/${perfil.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: perfilUsuario.nombre, apellido: perfilUsuario.apellido,
          email: perfilUsuario.email,
          cupo_base: Number(cupoEdit) || 0,
        }),
      });
      if (res.ok) await openPerfil(perfil.user_id);
      else alert('No se pudo guardar el cupo');
    } finally { setCupoSaving(false); }
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    let userId: number | '' = typeof form.user_id === 'number' ? form.user_id : '';

    if (form.user_id === 'nuevo') {
      if (!form.nuevo_nombre.trim() || !form.nuevo_apellido.trim()) {
        setError('Nombre y apellido de la persona son obligatorios'); setLoading(false); return;
      }
      try {
        const res = await guardedFetch(API_USUARIOS, {
          method: 'POST',
          body: JSON.stringify({
            nombre: form.nuevo_nombre.trim(), apellido: form.nuevo_apellido.trim(),
            email: form.nuevo_correo.trim() || undefined,
            telefono: form.nuevo_telefono.trim() || undefined,
            direccion: form.nuevo_direccion.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Error al registrar la persona'); setLoading(false); return; }
        userId = json.data.id;
        loadUsuarios(); // la persona recién creada debe aparecer en el desplegable
      } catch { setError('No se pudo registrar la persona'); setLoading(false); return; }
    }

    if (!userId) { setError('Selecciona o registra una persona'); setLoading(false); return; }

    try {
      const body = { fecha: form.fecha, user_id: userId, articulos: form.articulos.trim(), deuda_inicial: Number(form.deuda_inicial) };
      const res = await guardedFetch(API_CREDITOS, { method: 'POST', body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      setModal(false); load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleAbono = async () => {
    if (!abonoModal.creditoId || !abonoMonto) return;
    const res = await guardedFetch(`${API_CREDITOS}/${abonoModal.creditoId}/abono`, {
      method: 'PATCH', body: JSON.stringify({ monto: Number(abonoMonto) }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? 'Error'); return; }
    setAbonoModal({ open: false, creditoId: null }); setAbonoMonto(''); load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este credito?')) return;
    await guardedFetch(`${API_CREDITOS}/${id}`, { method: 'DELETE' }); load();
  };

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={total}>Creditos</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="creditos" guardedFetch={guardedFetch} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={() => { setForm(emptyCreditoForm()); setError(''); setModal(true); }}>
              + Nuevo credito
            </Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={creditosColumns}
          rows={creditos}
          rowKey={c => c.id}
          onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={c => (
            <>
              <Button
                variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary"
                title="Perfil crediticio (cupo y comportamiento)"
                onClick={() => openPerfil(c.cliente.id)}
              >
                <Gauge className="size-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary"
                title="Registrar abono"
                onClick={() => { setAbonoModal({ open: true, creditoId: c.id }); setAbonoMonto(''); }}
              >
                <CircleDollarSign className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)} title="Eliminar">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        />
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="creditos"
        guardedFetch={guardedFetch}
        onImported={() => load(1)}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nuevo credito"
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : 'Registrar credito'}
        loading={loading}
      >
        <FieldRow>
          <Field label="Fecha *">
            <Input type="date" required value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          </Field>
          <Field label="Deuda inicial (COP) *">
            <Input type="number" min="1" required value={form.deuda_inicial}
              onChange={e => setForm(f => ({ ...f, deuda_inicial: e.target.value }))} />
          </Field>
        </FieldRow>
        <Field label="Cliente *">
          <NativeSelect value={String(form.user_id)}
            onChange={e => setForm(f => ({ ...f, user_id: parseClienteSeleccion(e.target.value) }))}>
            <option value="">— Selecciona una persona —</option>
            <option value="nuevo">+ Registrar persona nueva</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{personaLabel(u)}</option>)}
          </NativeSelect>
        </Field>
        {form.user_id === 'nuevo' && (
          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3.5">
            <FieldRow>
              <Field label="Nombre *">
                <Input value={form.nuevo_nombre} maxLength={60}
                  onChange={e => setForm(f => ({ ...f, nuevo_nombre: e.target.value }))} />
              </Field>
              <Field label="Apellido *">
                <Input value={form.nuevo_apellido} maxLength={60}
                  onChange={e => setForm(f => ({ ...f, nuevo_apellido: e.target.value }))} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Telefono">
                <Input value={form.nuevo_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nuevo_telefono: e.target.value }))} />
              </Field>
              <Field label="Correo">
                <Input type="email" value={form.nuevo_correo} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nuevo_correo: e.target.value }))} />
              </Field>
            </FieldRow>
            <Field label="Direccion">
              <Input value={form.nuevo_direccion} maxLength={150}
                onChange={e => setForm(f => ({ ...f, nuevo_direccion: e.target.value }))} />
            </Field>
          </div>
        )}
        <Field label="Articulos *">
          <Textarea rows={2} required value={form.articulos} maxLength={300}
            onChange={e => setForm(f => ({ ...f, articulos: e.target.value }))} />
        </Field>
        <FormError>{error}</FormError>
      </Modal>

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

      {/* Perfil crediticio interno: cupo, comportamiento de pago y veto (solo admin) */}
      <Modal
        open={perfilOpen}
        onClose={() => setPerfilOpen(false)}
        title={perfil ? `Perfil crediticio · ${perfil.nombre}` : 'Perfil crediticio'}
        maxWidth={520}
        footer={
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPerfilOpen(false)}>Cerrar</Button>
          </DialogFooter>
        }
      >
        {!perfil && <p className="py-6 text-center text-sm text-muted-foreground">Calculando perfil…</p>}

        {perfil && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {perfil.vetado && (
                <span className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[12px] font-semibold text-rose-600">
                  <ShieldAlert className="size-3.5" /> VETADO para credito directo
                </span>
              )}
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-[12px] font-semibold',
                  perfil.tiene_credito_activo
                    ? 'border-amber-200 bg-amber-50 text-amber-600'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-600',
                )}
              >
                {perfil.tiene_credito_activo ? 'Credito activo' : 'Sin deudas'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cupo actual</p>
                <p className="mt-0.5 text-[17px] font-semibold text-foreground">{formatPrice(perfil.cupo)}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Factor {perfil.factor}x sobre el cupo base
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Disponible</p>
                <p className="mt-0.5 text-[17px] font-semibold text-primary">{formatPrice(perfil.cupo_disponible)}</p>
                <p className="text-[11.5px] text-muted-foreground">Deuda actual: {formatPrice(perfil.deuda_total)}</p>
              </div>
            </div>

            <Field label="Cupo base (COP) — lo defines tu, el factor lo ajusta solo">
              <div className="flex gap-2">
                <Input type="number" min="0" value={cupoEdit} onChange={e => setCupoEdit(e.target.value)} />
                <Button onClick={saveCupo} disabled={cupoSaving}>
                  {cupoSaving ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </Field>

            {perfil.eventos.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Comportamiento de pago
                </p>
                <ul className="flex flex-col gap-1.5">
                  {perfil.eventos.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]">
                      {ev.tipo === 'pago_rapido' && <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />}
                      {ev.tipo === 'pago_lento' && <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-amber-600" />}
                      {ev.tipo === 'veto' && <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-rose-600" />}
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">Credito #{ev.credito_id}:</span> {ev.detalle}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {perfil.eventos.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                Sin eventos de comportamiento todavia (pagos rapidos suben el cupo, moras lo bajan).
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
