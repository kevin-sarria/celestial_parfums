import { useRef, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { SmartTable } from '../../../components/table/SmartTable';
import { perfumesColumns } from '../columns';
import { API, subirImagenAdmin } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError } from '../ui';
import type { GuardedFetch, Lookup, PerfumeForm } from '../types';
import { emptyPerfumeForm } from '../types';

interface PerfumesTabProps {
  perfumes: Perfume[];
  page: number;
  total: number;
  pageSize: number;
  aromas: Lookup[];
  ocasiones: Lookup[];
  categorias: Lookup[];
  presentaciones: Lookup[];
  guardedFetch: GuardedFetch;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Búsqueda global contra el backend (toda la data, no solo la página cargada). */
  onSearch: (term: string) => void;
  onMutate: () => void;
}

interface CheckGroupProps {
  items: Lookup[];
  selected: number[];
  onToggle: (id: number) => void;
}

/** Grupo de checkboxes para relaciones (aromas, ocasiones, presentaciones). */
function CheckGroup({ items, selected, onToggle }: CheckGroupProps) {
  return (
    <div className="grid max-h-36 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-2.5">
      {items.map(item => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-foreground transition-colors hover:bg-secondary"
        >
          <input
            type="checkbox"
            className="accent-primary"
            checked={selected.includes(item.id)}
            onChange={() => onToggle(item.id)}
          />
          {item.nombre}
        </label>
      ))}
    </div>
  );
}

export function PerfumesTab({
  perfumes, page, total, pageSize, aromas, ocasiones, categorias, presentaciones,
  guardedFetch, onPageChange, onPageSizeChange, onSearch, onMutate,
}: PerfumesTabProps) {
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<PerfumeForm>(emptyPerfumeForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [imgMode, setImgMode] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setForm(emptyPerfumeForm()); setFormError(''); setImgMode('url'); setModal({ open: true, editId: null }); };
  const openEdit = (p: Perfume) => {
    const aromaIds = aromas.filter(a => p.tipos_aroma.includes(a.nombre)).map(a => a.id);
    const ocasionIds = ocasiones.filter(o => p.ocasiones.includes(o.nombre)).map(o => o.id);
    const presentacionIds = presentaciones.filter(pr => p.presentaciones.includes(pr.nombre)).map(pr => pr.id);
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio),
      duracion: p.duracion ?? '', proyeccion: p.proyeccion ?? '', imagen_url: p.imagen_url ?? '',
      genero: p.genero ?? '', categoria_id: p.categoria_id ?? '',
      tipos_aroma: aromaIds, ocasiones: ocasionIds, presentaciones: presentacionIds,
    });
    setFormError(''); setImgMode('url'); setModal({ open: true, editId: p.id });
  };
  const closeModal = () => setModal({ open: false, editId: null });

  const toggleId = (ids: number[], id: number) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  const setF = (field: keyof PerfumeForm) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleFileUpload = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await subirImagenAdmin(guardedFetch, file);
      setForm(f => ({ ...f, imagen_url: url }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al subir imagen');
    } finally { setUploading(false); }
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.precio) { setFormError('Nombre y precio son obligatorios'); return; }
    setFormLoading(true); setFormError('');
    const body = {
      nombre: form.nombre, descripcion: form.descripcion || null, precio: Number(form.precio),
      duracion: form.duracion || null, proyeccion: form.proyeccion || null,
      imagen_url: form.imagen_url || null, genero: form.genero || null,
      categoria_id: form.categoria_id !== '' ? Number(form.categoria_id) : null,
      tipos_aroma: form.tipos_aroma, ocasiones: form.ocasiones, presentaciones: form.presentaciones,
    };
    try {
      const url = modal.editId ? `${API}/update/${modal.editId}` : `${API}/create`;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await guardedFetch(url, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setFormError(json.error ?? 'Error al guardar'); return; }
      closeModal(); onMutate();
    } catch { setFormError('No se pudo conectar con el servidor'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este perfume? Esta acción no se puede deshacer.')) return;
    await guardedFetch(`${API}/delete/${id}`, { method: 'DELETE' });
    onMutate();
  };

  const handleToggleAgotado = async (p: Perfume) => {
    await guardedFetch(`${API}/${p.id}/agotado`, { method: 'PATCH', body: JSON.stringify({ agotado: !p.agotado }) });
    onMutate();
  };

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={perfumes.length}>Perfumes</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="perfumes" guardedFetch={guardedFetch} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={openCreate}>+ Nuevo perfume</Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={perfumesColumns}
          rows={perfumes}
          rowKey={p => p.id}
          onServerSearch={onSearch}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          renderActions={p => (
            <>
              <button onClick={() => handleToggleAgotado(p)} title="Cambiar stock" className="cursor-pointer">
                {p.agotado ? (
                  <Badge variant="secondary" className="text-muted-foreground">Agotado</Badge>
                ) : (
                  <Badge variant="outline" className="border-primary/30 bg-brand-soft text-primary">En stock</Badge>
                )}
              </button>
              {p.imagen_url && (
                <img src={p.imagen_url} alt={p.nombre} className="size-8 rounded-md border border-border object-cover" />
              )}
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
        entity="perfumes"
        guardedFetch={guardedFetch}
        onImported={onMutate}
      />

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar perfume' : 'Nuevo perfume'}
        onSubmit={handleSubmit}
        submitLabel={formLoading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Crear perfume'}
        loading={formLoading}
        maxWidth={620}
      >
        <FieldRow>
          <Field label="Nombre *">
            <Input value={form.nombre} onChange={setF('nombre')} required maxLength={100} />
          </Field>
          <Field label="Precio (COP) *">
            <Input type="number" min="0" value={form.precio} onChange={setF('precio')} required />
          </Field>
        </FieldRow>
        <Field label="Descripcion">
          <Textarea value={form.descripcion} onChange={setF('descripcion')} rows={2} maxLength={500} />
        </Field>
        <FieldRow>
          <Field label="Duracion">
            <Input placeholder="ej: 6-8 horas" value={form.duracion} onChange={setF('duracion')} maxLength={50} />
          </Field>
          <Field label="Proyeccion">
            <Input placeholder="ej: Moderada" value={form.proyeccion} onChange={setF('proyeccion')} maxLength={50} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Genero">
            <NativeSelect value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value as PerfumeForm['genero'] }))}>
              <option value="">— Sin especificar —</option>
              <option value="dama">Dama</option>
              <option value="caballero">Caballero</option>
              <option value="unisex">Unisex</option>
            </NativeSelect>
          </Field>
          <Field label="Categoria">
            <NativeSelect value={form.categoria_id}
              onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value === '' ? '' : Number(e.target.value) }))}>
              <option value="">— Sin especificar —</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </NativeSelect>
          </Field>
        </FieldRow>

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
            <Input placeholder="https://..." value={form.imagen_url} onChange={setF('imagen_url')} maxLength={500} />
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
          <Field label="Tipos de aroma">
            <CheckGroup items={aromas} selected={form.tipos_aroma}
              onToggle={id => setForm(f => ({ ...f, tipos_aroma: toggleId(f.tipos_aroma, id) }))} />
          </Field>
          <Field label="Ocasiones">
            <CheckGroup items={ocasiones} selected={form.ocasiones}
              onToggle={id => setForm(f => ({ ...f, ocasiones: toggleId(f.ocasiones, id) }))} />
          </Field>
        </FieldRow>
        <Field label="Presentaciones disponibles">
          <CheckGroup items={presentaciones} selected={form.presentaciones}
            onToggle={id => setForm(f => ({ ...f, presentaciones: toggleId(f.presentaciones, id) }))} />
        </Field>
        <FormError>{formError}</FormError>
      </Modal>
    </>
  );
}
