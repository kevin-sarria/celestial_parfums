import { useEffect, useState } from 'react';
import { CheckCircle2, Link2, Pencil, Trash2, TriangleAlert, Upload, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { ventasColumns } from '../columns';
import { API, API_VENTAS, API_USUARIOS, DEFAULT_PAGE_SIZE, formatPrice, parseClienteSeleccion, personaLabel, validarCodigoDescuento } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, StatCard, StatRow } from '../ui';
import type { CodigoValidado, GuardedFetch, Venta, VentaForm, Usuario } from '../types';
import { emptyVentaForm } from '../types';

interface VentasTabProps {
  guardedFetch: GuardedFetch;
}

interface PerfumeOption {
  id: number;
  nombre: string;
}

export function VentasTab({ guardedFetch }: VentasTabProps) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<{ total_unidades: number; total_dinero: number } | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfumes, setPerfumes] = useState<PerfumeOption[]>([]);

  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<VentaForm>(emptyVentaForm());
  // Referencia libre de una venta importada que no coincidió con el catálogo
  const [referenciaInvalida, setReferenciaInvalida] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Ventas y totales cambian con cada acción; personas y catálogo solo al montar
  const load = async (p = page, s = pageSize, term = searchTerm) => {
    const searchQs = term ? `&search=${encodeURIComponent(term)}` : '';
    const [vRes, tRes] = await Promise.all([
      guardedFetch(`${API_VENTAS}?page=${p}&limit=${s}${searchQs}`),
      guardedFetch(`${API_VENTAS}/totales`),
    ]);
    const [v, t] = await Promise.all([vRes.json(), tRes.json()]);
    setVentas(v.data ?? []);
    setTotal(v.total ?? 0);
    setPage(p);
    setTotales(t.data ?? null);
  };

  const loadCatalogos = async () => {
    const [uRes, pRes] = await Promise.all([guardedFetch(API_USUARIOS), fetch(`${API}/`)]);
    const [u, pf] = await Promise.all([uRes.json(), pRes.json()]);
    setUsuarios((u.data ?? []).filter((x: Usuario) => x.rol_id !== 1));
    setPerfumes(
      ((pf.data?.data ?? []) as PerfumeOption[])
        .map((x) => ({ id: x.id, nombre: x.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    );
  };

  useEffect(() => { load(1); loadCatalogos(); }, []);

  // Certificación inline del código de descuento del pedido
  const [codigoCheck, setCodigoCheck] = useState<CodigoValidado | null>(null);
  const [checking, setChecking] = useState(false);

  const openCreate = () => {
    setForm(emptyVentaForm()); setReferenciaInvalida(''); setError(''); setCodigoCheck(null);
    setModal({ open: true, editId: null });
  };
  const openEdit = (v: Venta) => {
    setForm({
      ...emptyVentaForm(),
      dia: v.dia.slice(0, 10), persona: v.persona,
      user_id: v.user_id ?? '',
      cantidad_perfumes: String(v.cantidad_perfumes), presentacion: v.presentacion,
      perfume_ids: v.perfumes.map(p => p.id),
      valor_venta: String(v.valor_venta),
      datos_adicionales: v.datos_adicionales ?? '',
      pagada: v.pagada,
      codigo_descuento: v.codigo?.codigo ?? '',
    });
    // Venta importada cuya referencia libre no coincidió con ningún perfume
    setReferenciaInvalida(v.perfumes.length === 0 ? v.referencia_perfume : '');
    setError(''); setCodigoCheck(null); setModal({ open: true, editId: v.id });
  };
  const closeModal = () => setModal({ open: false, editId: null });

  const validarCodigo = async () => {
    const codigo = form.codigo_descuento.trim();
    if (!codigo) return;
    setChecking(true); setCodigoCheck(null);
    setCodigoCheck(await validarCodigoDescuento(guardedFetch, codigo));
    setChecking(false);
  };

  const addPerfume = (id: number) => {
    if (!id) return;
    setForm(f => (f.perfume_ids.includes(id) ? f : { ...f, perfume_ids: [...f.perfume_ids, id] }));
  };
  const removePerfume = (id: number) =>
    setForm(f => ({ ...f, perfume_ids: f.perfume_ids.filter(x => x !== id) }));

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');

    if (form.perfume_ids.length === 0) {
      setError('Selecciona al menos un perfume del catálogo'); setLoading(false); return;
    }

    // Enlace de persona opcional: '' = sin enlace, 'nuevo' = crear ficha, número = existente.
    let userId: number | null = typeof form.user_id === 'number' ? form.user_id : null;

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
        if (!res.ok) { setError(json.error ?? 'Error al crear la persona'); setLoading(false); return; }
        userId = json.data.id;
      } catch { setError('No se pudo crear la persona'); setLoading(false); return; }
    }

    const body = {
      dia: form.dia, persona: form.persona.trim(),
      user_id: userId,
      cantidad_perfumes: Number(form.cantidad_perfumes),
      presentacion: form.presentacion,
      perfume_ids: form.perfume_ids,
      valor_venta: Number(form.valor_venta),
      datos_adicionales: form.datos_adicionales.trim() || null,
      pagada: form.pagada,
      codigo_descuento: form.codigo_descuento.trim().toUpperCase() || null,
    };
    try {
      const url = modal.editId ? `${API_VENTAS}/${modal.editId}` : API_VENTAS;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await guardedFetch(url, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      closeModal(); load();
      if (form.user_id === 'nuevo') loadCatalogos(); // la persona recién creada debe aparecer
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    await guardedFetch(`${API_VENTAS}/${id}`, { method: 'DELETE' }); load();
  };

  const [enlazando, setEnlazando] = useState(false);
  // Reintenta la inferencia venta→perfumes para las ventas importadas sin enlazar
  const handleEnlazar = async () => {
    setEnlazando(true);
    try {
      const res = await guardedFetch(`${API_VENTAS}/enlazar-perfumes`, { method: 'POST' });
      const json = await res.json();
      alert(res.ok ? json.message : (json.error ?? 'Error al enlazar'));
      if (res.ok) load();
    } catch { alert('No se pudo conectar con el servidor'); }
    finally { setEnlazando(false); }
  };

  const disponibles = perfumes.filter(p => !form.perfume_ids.includes(p.id));

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={total}>Ventas</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="ventas" guardedFetch={guardedFetch} />
            <Button
              variant="outline" size="sm" disabled={enlazando}
              title="Intenta enlazar por nombre las ventas importadas que aún no tienen perfume del catálogo"
              onClick={handleEnlazar}
            >
              <Link2 className="size-4" /> {enlazando ? 'Enlazando…' : 'Enlazar perfumes'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={openCreate}>+ Registrar venta</Button>
          </ToolbarActions>
        </Toolbar>

        {totales && (
          <StatRow>
            <StatCard label="Total unidades vendidas" value={totales.total_unidades} />
            <StatCard label="Total en dinero" value={formatPrice(totales.total_dinero)} />
          </StatRow>
        )}

        <SmartTable
          columns={ventasColumns}
          rows={ventas}
          rowKey={v => v.id}
          onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={v => (
            <>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(v)} title="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(v.id)} title="Eliminar">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        />
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="ventas"
        guardedFetch={guardedFetch}
        onImported={() => load(1)}
      />

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar venta' : 'Registrar venta'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Registrar'}
        loading={loading}
      >
        <FieldRow>
          <Field label="Dia *">
            <Input type="date" required value={form.dia}
              onChange={e => setForm(f => ({ ...f, dia: e.target.value }))} />
          </Field>
          <Field label="Persona *">
            <Input required value={form.persona} maxLength={100}
              onChange={e => setForm(f => ({ ...f, persona: e.target.value }))} />
          </Field>
        </FieldRow>

        <Field label="Cliente enlazado (opcional)">
          <BuscadorSelect
            value={String(form.user_id)}
            placeholder="— Sin cliente —"
            opciones={[
              { id: '', nombre: '— Sin cliente —' },
              { id: 'nuevo', nombre: '+ Registrar persona nueva' },
              ...usuarios.map(u => ({ id: u.id, nombre: personaLabel(u) })),
            ]}
            onSelect={id => setForm(f => ({ ...f, user_id: parseClienteSeleccion(String(id)) }))}
          />
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
              <Field label="Correo (si se registra con él, hereda su historial)">
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

        <Field label="Perfumes vendidos * (elige uno o varios del catálogo)">
          <div className="space-y-2">
            {referenciaInvalida && form.perfume_ids.length === 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                "{referenciaInvalida}" no coincide con los perfumes registrados en la base de
                datos; por favor selecciona uno o varios válidos.
              </p>
            )}
            <BuscadorSelect
              opciones={disponibles}
              placeholder="Buscar y agregar perfume…"
              onSelect={(id) => addPerfume(Number(id))}
            />
            {/* Lo elegido se acumula debajo del control, como en cualquier multi-select */}
            {form.perfume_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.perfume_ids.map(id => {
                  const p = perfumes.find(x => x.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-medium text-primary">
                      {p?.nombre ?? `#${id}`}
                      <button type="button" aria-label={`Quitar ${p?.nombre ?? id}`}
                        className="rounded-full p-0.5 transition-colors hover:bg-primary/15"
                        onClick={() => removePerfume(id)}>
                        <X className="size-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </Field>

        <FieldRow>
          <Field label="Cantidad *">
            <Input type="number" min="1" required value={form.cantidad_perfumes}
              onChange={e => setForm(f => ({ ...f, cantidad_perfumes: e.target.value }))} />
          </Field>
          <Field label="Presentacion *">
            <NativeSelect value={form.presentacion}
              onChange={e => setForm(f => ({ ...f, presentacion: e.target.value }))}>
              {['10ML', '20ML', '30ML', '60ML', '100ML', '200ML'].map(p => <option key={p}>{p}</option>)}
            </NativeSelect>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Valor venta (COP) *">
            <Input type="number" min="0" required value={form.valor_venta}
              onChange={e => setForm(f => ({ ...f, valor_venta: e.target.value }))} />
          </Field>
          <Field label="Estado de pago">
            <NativeSelect value={form.pagada ? 'pagada' : 'pendiente'}
              onChange={e => setForm(f => ({ ...f, pagada: e.target.value === 'pagada' }))}>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente de pago</option>
            </NativeSelect>
          </Field>
        </FieldRow>

        <Field label="Código de descuento (si el pedido de WhatsApp traía uno)">
          <div className="flex gap-2">
            <Input value={form.codigo_descuento} maxLength={20} placeholder="Ej: CP-7XK2M9"
              className="uppercase"
              onChange={e => { setForm(f => ({ ...f, codigo_descuento: e.target.value })); setCodigoCheck(null); }} />
            <Button type="button" variant="outline" disabled={checking || !form.codigo_descuento.trim()} onClick={validarCodigo}>
              {checking ? 'Validando…' : 'Validar'}
            </Button>
          </div>
          {codigoCheck && (
            <p className={`mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium ${codigoCheck.valido || codigoCheck.venta ? 'text-emerald-700' : 'text-destructive'}`}>
              {codigoCheck.valido || codigoCheck.venta
                ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                : <XCircle className="mt-0.5 size-3.5 shrink-0" />}
              <span>
                {codigoCheck.motivo}
                {codigoCheck.cupon && ` — "${codigoCheck.cupon.titulo}" (-${codigoCheck.cupon.descuento_pct}%) de ${codigoCheck.persona}`}
              </span>
            </p>
          )}
          <p className="mt-1 text-[12px] text-muted-foreground">
            El código se canjea (deja de servir) cuando la venta queda marcada como pagada;
            si la venta se edita sin código o se elimina, vuelve a quedar activo.
          </p>
        </Field>

        <Field label="Datos adicionales">
          <Textarea rows={2} value={form.datos_adicionales} maxLength={300}
            onChange={e => setForm(f => ({ ...f, datos_adicionales: e.target.value }))} />
        </Field>
        <FormError>{error}</FormError>
      </Modal>
    </>
  );
}
