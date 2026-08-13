import { useRef, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectSimple } from '@/components/ui/select-simple';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import type { Combo } from '../../../domain/entities/combo.schema';
import { SmartTable } from '../../../components/table/SmartTable';
import { combosColumns } from '../columns';
import { API_COMBOS, subirImagenAdmin } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError } from '../ui';
import type { GuardedFetch, Lookup, ComboForm } from '../types';
import { emptyComboForm } from '../types';

interface CombosTabProps {
  combos: Combo[];
  page: number;
  total: number;
  pageSize: number;
  categorias: Lookup[];
  presentaciones: Lookup[];
  guardedFetch: GuardedFetch;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Búsqueda global contra el backend (toda la data, no solo la página cargada). */
  onSearch: (term: string) => void;
  onMutate: () => void;
}

export function CombosTab({
  combos, page, total, pageSize, categorias, presentaciones,
  guardedFetch, onPageChange, onPageSizeChange, onSearch, onMutate,
}: CombosTabProps) {
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<ComboForm>(emptyComboForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [imgMode, setImgMode] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setForm(emptyComboForm()); setFormError(''); setImgMode('url'); setModal({ open: true, editId: null }); };
  const openEdit = (c: Combo) => {
    setForm({
      nombre: c.nombre, descripcion: c.descripcion ?? '', imagen_url: c.imagen_url ?? '',
      categoria_id: c.categoria_id ?? '', presentacion_id: c.presentacion_id ?? '',
      cantidad: String(c.cantidad), precio: String(c.precio),
      descuento: String(c.descuento), activo: c.activo,
    });
    setFormError(''); setImgMode('url'); setModal({ open: true, editId: c.id });
  };
  const closeModal = () => setModal({ open: false, editId: null });

  const handleFileUpload = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await subirImagenAdmin(guardedFetch, file);
      setForm(f => ({ ...f, imagen_url: url }));
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Error al subir imagen'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setFormLoading(true); setFormError('');
    const body = {
      nombre: form.nombre, descripcion: form.descripcion || null,
      imagen_url: form.imagen_url || null,
      categoria_id: form.categoria_id !== '' ? Number(form.categoria_id) : null,
      presentacion_id: form.presentacion_id !== '' ? Number(form.presentacion_id) : null,
      cantidad: Number(form.cantidad), precio: Number(form.precio),
      descuento: Number(form.descuento), activo: form.activo,
    };
    try {
      const url = modal.editId ? `${API_COMBOS}/${modal.editId}` : API_COMBOS;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await guardedFetch(url, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setFormError(json.error ?? 'Error al guardar'); return; }
      closeModal(); onMutate();
    } catch { setFormError('No se pudo conectar con el servidor'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este combo?')) return;
    await guardedFetch(`${API_COMBOS}/${id}`, { method: 'DELETE' }); onMutate();
  };

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={combos.length}>Combos</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="combos" guardedFetch={guardedFetch} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={openCreate}>+ Nuevo combo</Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={combosColumns}
          rows={combos}
          rowKey={c => c.id}
          onServerSearch={onSearch}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          renderActions={c => (
            <>
              {c.imagen_url && (
                <img src={c.imagen_url} alt={c.nombre} className="size-8 rounded-md border border-border object-cover" />
              )}
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)} title="Editar">
                <Pencil className="size-4" />
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
        entity="combos"
        guardedFetch={guardedFetch}
        onImported={onMutate}
      />

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar combo' : 'Nuevo combo'}
        onSubmit={handleSubmit}
        submitLabel={formLoading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Crear combo'}
        loading={formLoading}
      >
        <Field label="Nombre *">
          <Input value={form.nombre} required maxLength={100}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        </Field>
        <Field label="Descripcion">
          <Textarea rows={2} value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        </Field>
        <Field label="Imagen">
          <div className="mb-2 inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', imgMode === 'url' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setImgMode('url')}
            >
              URL
            </button>
            <button
              type="button"
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', imgMode === 'file' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => { setImgMode('file'); fileInputRef.current?.click(); }}
            >
              Subir archivo
            </button>
          </div>
          {imgMode === 'url' ? (
            <Input placeholder="https://..." value={form.imagen_url} maxLength={500}
              onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} />
          ) : (
            <div
              className="flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Subiendo...' : form.imagen_url
                ? <><img src={form.imagen_url} alt="preview" className="h-16 rounded-lg object-cover" /> <span>Cambiar</span></>
                : '📁 Haz clic para seleccionar una imagen'}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          {form.imagen_url && imgMode === 'url' && (
            <img src={form.imagen_url} alt="preview" className="mt-2 h-20 rounded-lg border border-border object-cover" />
          )}
        </Field>
        <FieldRow>
          <Field label="Categoria">
            <SelectSimple value={form.categoria_id}
              onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value !== '' ? Number(e.target.value) : '' }))}>
              <option value="">Sin categoria</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </SelectSimple>
          </Field>
          <Field label="Presentacion de los perfumes">
            <SelectSimple value={form.presentacion_id}
              onChange={e => setForm(f => ({ ...f, presentacion_id: e.target.value !== '' ? Number(e.target.value) : '' }))}>
              <option value="">Cualquier tamaño</option>
              {presentaciones.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </SelectSimple>
          </Field>
        </FieldRow>
        <p className="-mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Con categoría y presentación definidas, el carrito detecta el combo
          automáticamente cuando el cliente junta esa cantidad de perfumes sueltos
          y le cobra el precio del combo.
        </p>
        <FieldRow>
          <Field label="Cantidad de perfumes *">
            <Input type="number" min="1" required value={form.cantidad}
              onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
          </Field>
          <Field label="Precio (COP) *">
            <Input type="number" min="0" required value={form.precio}
              onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Descuento (%)">
            <Input type="number" min="0" max="100" value={form.descuento}
              onChange={e => setForm(f => ({ ...f, descuento: e.target.value }))} />
          </Field>
          <Field label="Estado">
            <SelectSimple value={form.activo ? 'true' : 'false'}
              onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'true' }))}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </SelectSimple>
          </Field>
        </FieldRow>
        <FormError>{formError}</FormError>
      </Modal>
    </>
  );
}
