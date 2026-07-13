import { useEffect, useState } from 'react';
import { CircleDollarSign, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { DialogFooter } from '@/components/ui/dialog';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { creditosColumns } from '../columns';
import { API_CREDITOS, API_CLIENTES, DEFAULT_PAGE_SIZE } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError } from '../ui';
import type { GuardedFetch, Credito, Cliente, CreditoForm } from '../types';
import { emptyCreditoForm } from '../types';

interface CreditosTabProps {
  guardedFetch: GuardedFetch;
}

export function CreditosTab({ guardedFetch }: CreditosTabProps) {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<CreditoForm>(emptyCreditoForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const [abonoModal, setAbonoModal] = useState<{ open: boolean; creditoId: number | null }>({ open: false, creditoId: null });
  const [abonoMonto, setAbonoMonto] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const load = async (p = page, s = pageSize, term = searchTerm) => {
    const searchQs = term ? `&search=${encodeURIComponent(term)}` : '';
    const [cRes, clRes] = await Promise.all([
      guardedFetch(`${API_CREDITOS}?page=${p}&limit=${s}${searchQs}`),
      guardedFetch(API_CLIENTES),
    ]);
    const [cJson, clJson] = await Promise.all([cRes.json(), clRes.json()]);
    setCreditos(cJson.data ?? []);
    setTotal(cJson.total ?? 0);
    setPage(p);
    setClientes(clJson.data ?? []);
  };

  useEffect(() => { load(1); }, []);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    let clienteId: number | '' = form.cliente_id === 'nuevo' ? '' : (form.cliente_id as number | '');

    if (form.cliente_id === 'nuevo') {
      if (!form.nuevo_nombre.trim() || !form.nuevo_apellido.trim()) {
        setError('Nombre y apellido del cliente son obligatorios'); setLoading(false); return;
      }
      try {
        const res = await guardedFetch(API_CLIENTES, {
          method: 'POST',
          body: JSON.stringify({
            nombre: form.nuevo_nombre.trim(), apellido: form.nuevo_apellido.trim(),
            correo: form.nuevo_correo.trim() || null,
            telefono: form.nuevo_telefono.trim() || null,
            direccion: form.nuevo_direccion.trim() || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Error al crear cliente'); setLoading(false); return; }
        clienteId = json.data.id;
      } catch { setError('No se pudo crear el cliente'); setLoading(false); return; }
    }

    if (!clienteId) { setError('Selecciona o crea un cliente'); setLoading(false); return; }

    try {
      const body = { fecha: form.fecha, cliente_id: clienteId, articulos: form.articulos.trim(), deuda_inicial: Number(form.deuda_inicial) };
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
          <NativeSelect value={String(form.cliente_id)}
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, cliente_id: val === '' ? '' : val === 'nuevo' ? 'nuevo' : Number(val) }));
            }}>
            <option value="">— Selecciona un cliente —</option>
            <option value="nuevo">+ Crear cliente nuevo</option>
            {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.nombre} {cl.apellido}{cl.telefono ? ` · ${cl.telefono}` : ''}</option>)}
          </NativeSelect>
        </Field>
        {form.cliente_id === 'nuevo' && (
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
    </>
  );
}
