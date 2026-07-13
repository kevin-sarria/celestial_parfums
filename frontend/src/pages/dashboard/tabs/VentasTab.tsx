import { useEffect, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { ventasColumns } from '../columns';
import { API_VENTAS, DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, StatCard, StatRow } from '../ui';
import type { GuardedFetch, Venta, VentaForm } from '../types';
import { emptyVentaForm } from '../types';

interface VentasTabProps {
  guardedFetch: GuardedFetch;
}

export function VentasTab({ guardedFetch }: VentasTabProps) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<{ total_unidades: number; total_dinero: number } | null>(null);

  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<VentaForm>(emptyVentaForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => { load(1); }, []);

  const openCreate = () => { setForm(emptyVentaForm()); setError(''); setModal({ open: true, editId: null }); };
  const openEdit = (v: Venta) => {
    setForm({
      dia: v.dia.slice(0, 10), persona: v.persona,
      cantidad_perfumes: String(v.cantidad_perfumes), presentacion: v.presentacion,
      referencia_perfume: v.referencia_perfume, valor_venta: String(v.valor_venta),
      datos_adicionales: v.datos_adicionales ?? '',
    });
    setError(''); setModal({ open: true, editId: v.id });
  };
  const closeModal = () => setModal({ open: false, editId: null });

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    const body = {
      dia: form.dia, persona: form.persona.trim(),
      cantidad_perfumes: Number(form.cantidad_perfumes),
      presentacion: form.presentacion,
      referencia_perfume: form.referencia_perfume.trim(),
      valor_venta: Number(form.valor_venta),
      datos_adicionales: form.datos_adicionales.trim() || null,
    };
    try {
      const url = modal.editId ? `${API_VENTAS}/${modal.editId}` : API_VENTAS;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await guardedFetch(url, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      closeModal(); load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    await guardedFetch(`${API_VENTAS}/${id}`, { method: 'DELETE' }); load();
  };

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={total}>Ventas</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="ventas" guardedFetch={guardedFetch} />
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
        <Field label="Referencia(s) de perfume *">
          <Input required placeholder="Ej: Invictus, Sauvage" value={form.referencia_perfume} maxLength={200}
            onChange={e => setForm(f => ({ ...f, referencia_perfume: e.target.value }))} />
        </Field>
        <Field label="Valor venta (COP) *">
          <Input type="number" min="0" required value={form.valor_venta}
            onChange={e => setForm(f => ({ ...f, valor_venta: e.target.value }))} />
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
