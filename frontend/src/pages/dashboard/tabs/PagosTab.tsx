import { useEffect, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { pagosColumns } from '../columns';
import { API_PAGOS, API_EMPRESAS, DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, StatCard, StatRow } from '../ui';
import type { GuardedFetch, Pago, Empresa, PagoForm } from '../types';
import { emptyPagoForm } from '../types';

interface PagosTabProps {
  guardedFetch: GuardedFetch;
}

export function PagosTab({ guardedFetch }: PagosTabProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<{ total_compras: number; total_envios: number } | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<PagoForm>(emptyPagoForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const load = async (p = page, s = pageSize, term = searchTerm) => {
    const searchQs = term ? `&search=${encodeURIComponent(term)}` : '';
    const [pRes, tRes, eRes] = await Promise.all([
      guardedFetch(`${API_PAGOS}?page=${p}&limit=${s}${searchQs}`),
      guardedFetch(`${API_PAGOS}/totales`),
      guardedFetch(API_EMPRESAS),
    ]);
    const [pJson, tJson, eJson] = await Promise.all([pRes.json(), tRes.json(), eRes.json()]);
    setPagos(pJson.data ?? []);
    setTotal(pJson.total ?? 0);
    setPage(p);
    setTotales(tJson.data ?? null);
    setEmpresas(eJson.data ?? []);
  };

  useEffect(() => { load(1); }, []);

  const openCreate = () => { setForm(emptyPagoForm()); setError(''); setModal({ open: true, editId: null }); };
  const openEdit = (p: Pago) => {
    setForm({
      dia: p.dia.slice(0, 10), empresa_id: p.empresa.id,
      nueva_nombre: '', nueva_nit: '', nueva_telefono: '', nueva_correo: '', nueva_direccion: '',
      valor_compra: String(p.valor_compra), coste_envio: String(p.coste_envio),
      detalles_adicionales: p.detalles_adicionales ?? '',
    });
    setError(''); setModal({ open: true, editId: p.id });
  };
  const closeModal = () => setModal({ open: false, editId: null });

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    let empresaId: number | '' = form.empresa_id === 'nuevo' ? '' : (form.empresa_id as number | '');

    if (form.empresa_id === 'nuevo') {
      if (!form.nueva_nombre.trim()) { setError('El nombre de la empresa es obligatorio'); setLoading(false); return; }
      try {
        const res = await guardedFetch(API_EMPRESAS, {
          method: 'POST',
          body: JSON.stringify({
            nombre: form.nueva_nombre.trim(), nit: form.nueva_nit.trim() || null,
            telefono: form.nueva_telefono.trim() || null, correo: form.nueva_correo.trim() || null,
            direccion: form.nueva_direccion.trim() || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Error al crear empresa'); setLoading(false); return; }
        empresaId = json.data.id;
      } catch { setError('No se pudo crear la empresa'); setLoading(false); return; }
    }

    if (!empresaId) { setError('Selecciona o crea una empresa'); setLoading(false); return; }

    try {
      const body = {
        dia: form.dia, empresa_id: empresaId,
        valor_compra: Number(form.valor_compra), coste_envio: Number(form.coste_envio),
        detalles_adicionales: form.detalles_adicionales.trim() || null,
      };
      const url = modal.editId ? `${API_PAGOS}/${modal.editId}` : API_PAGOS;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await guardedFetch(url, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      closeModal(); load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este pago?')) return;
    await guardedFetch(`${API_PAGOS}/${id}`, { method: 'DELETE' }); load();
  };

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={total}>Pagos a Proveedores</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="proveedores" guardedFetch={guardedFetch} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={openCreate}>+ Registrar pago</Button>
          </ToolbarActions>
        </Toolbar>

        {totales && (
          <StatRow>
            <StatCard label="Total en compras" value={formatPrice(totales.total_compras)} />
            <StatCard label="Total en envios" value={formatPrice(totales.total_envios)} />
            <StatCard label="Total general" value={formatPrice(totales.total_compras + totales.total_envios)} />
          </StatRow>
        )}

        <SmartTable
          columns={pagosColumns}
          rows={pagos}
          rowKey={p => p.id}
          onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={p => (
            <>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(p)} title="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p.id)} title="Eliminar">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        />
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="proveedores"
        guardedFetch={guardedFetch}
        onImported={() => load(1)}
      />

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar pago' : 'Registrar pago a proveedor'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Registrar'}
        loading={loading}
      >
        <FieldRow>
          <Field label="Dia *">
            <Input type="date" required value={form.dia}
              onChange={e => setForm(f => ({ ...f, dia: e.target.value }))} />
          </Field>
          <Field label="Valor compra (COP) *">
            <Input type="number" min="0" required value={form.valor_compra}
              onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))} />
          </Field>
        </FieldRow>
        <Field label="Empresa *">
          <BuscadorSelect
            value={String(form.empresa_id)}
            placeholder="— Selecciona una empresa —"
            opciones={[
              { id: '', nombre: '— Selecciona una empresa —' },
              ...(!modal.editId ? [{ id: 'nuevo', nombre: '+ Registrar empresa nueva' }] : []),
              ...empresas.map(em => ({ id: em.id, nombre: `${em.nombre}${em.nit ? ` · NIT: ${em.nit}` : ''}` })),
            ]}
            onSelect={id => {
              const val = String(id);
              setForm(f => ({ ...f, empresa_id: val === '' ? '' : val === 'nuevo' ? 'nuevo' : Number(val) }));
            }}
          />
        </Field>
        {form.empresa_id === 'nuevo' && (
          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3.5">
            <FieldRow>
              <Field label="Nombre empresa *">
                <Input value={form.nueva_nombre} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nueva_nombre: e.target.value }))} />
              </Field>
              <Field label="NIT">
                <Input value={form.nueva_nit} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nueva_nit: e.target.value }))} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Telefono">
                <Input value={form.nueva_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nueva_telefono: e.target.value }))} />
              </Field>
              <Field label="Correo">
                <Input type="email" value={form.nueva_correo} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nueva_correo: e.target.value }))} />
              </Field>
            </FieldRow>
            <Field label="Direccion">
              <Input value={form.nueva_direccion} maxLength={150}
                onChange={e => setForm(f => ({ ...f, nueva_direccion: e.target.value }))} />
            </Field>
          </div>
        )}
        <FieldRow>
          <Field label="Costo de envio (COP)">
            <Input type="number" min="0" value={form.coste_envio}
              onChange={e => setForm(f => ({ ...f, coste_envio: e.target.value }))} />
          </Field>
        </FieldRow>
        <Field label="Detalles adicionales">
          <Textarea rows={2} value={form.detalles_adicionales} maxLength={300}
            onChange={e => setForm(f => ({ ...f, detalles_adicionales: e.target.value }))} />
        </Field>
        <FormError>{error}</FormError>
      </Modal>
    </>
  );
}
