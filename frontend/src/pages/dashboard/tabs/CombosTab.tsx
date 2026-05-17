import { useRef, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Modal from '../../../components/Modal';
import type { Combo } from '../../../domain/entities/combo.schema';
import { SmartTable } from '../../../components/table/SmartTable';
import { combosColumns } from '../columns';
import { API_COMBOS } from '../helpers';
import { BASE_URL } from '../../../infrastructure/api/client';
import type { GuardedFetch, Lookup, ComboForm } from '../types';
import { emptyComboForm } from '../types';

interface CombosTabProps {
  combos: Combo[];
  page: number;
  total: number;
  pageSize: number;
  categorias: Lookup[];
  guardedFetch: GuardedFetch;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onMutate: () => void;
}

export function CombosTab({
  combos, page, total, pageSize, categorias,
  guardedFetch, onPageChange, onPageSizeChange, onMutate,
}: CombosTabProps) {
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<ComboForm>(emptyComboForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [imgMode, setImgMode] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setForm(emptyComboForm()); setFormError(''); setImgMode('url'); setModal({ open: true, editId: null }); };
  const openEdit = (c: Combo) => {
    setForm({
      nombre: c.nombre, descripcion: c.descripcion ?? '', imagen_url: c.imagen_url ?? '',
      categoria_id: c.categoria_id ?? '', cantidad: String(c.cantidad), precio: String(c.precio),
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
      const fd = new FormData();
      fd.append('image', file);
      const res = await guardedFetch(`${BASE_URL}/api/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al subir imagen');
      setForm(f => ({ ...f, imagen_url: json.url }));
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Error al subir imagen'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setFormLoading(true); setFormError('');
    const body = {
      nombre: form.nombre, descripcion: form.descripcion || null,
      imagen_url: form.imagen_url || null,
      categoria_id: form.categoria_id !== '' ? Number(form.categoria_id) : null,
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
      <section className="dash-section">
        <div className="dash-toolbar">
          <h2 className="dash-section-title">Combos <span className="dash-count">{combos.length}</span></h2>
          <button className="dash-btn-accent" onClick={openCreate}>+ Nuevo combo</button>
        </div>
        <SmartTable
          columns={combosColumns}
          rows={combos}
          rowKey={c => c.id}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          renderActions={c => (
            <>
              {c.imagen_url && <img src={c.imagen_url} alt={c.nombre} className="dash-thumb" style={{ marginRight: 4 }} />}
              <button className="dash-icon-btn" onClick={() => openEdit(c)} title="Editar"><FiEdit2 /></button>
              <button className="dash-icon-btn" onClick={() => handleDelete(c.id)} title="Eliminar"><FiTrash2 /></button>
            </>
          )}
        />
      </section>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar combo' : 'Nuevo combo'}
        onSubmit={handleSubmit}
        submitLabel={formLoading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Crear combo'}
        loading={formLoading}
      >
        <div className="dash-form-group">
          <label>Nombre *</label>
          <input className="dash-input" value={form.nombre} required maxLength={100}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        </div>
        <div className="dash-form-group">
          <label>Descripcion</label>
          <textarea className="dash-input dash-textarea" rows={2} value={form.descripcion} maxLength={300}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        </div>
        <div className="dash-form-group">
          <label>Imagen</label>
          <div className="dash-img-toggle">
            <button type="button" className={`dash-img-tab${imgMode === 'url' ? ' dash-img-tab--active' : ''}`} onClick={() => setImgMode('url')}>URL</button>
            <button type="button" className={`dash-img-tab${imgMode === 'file' ? ' dash-img-tab--active' : ''}`} onClick={() => { setImgMode('file'); fileInputRef.current?.click(); }}>Subir archivo</button>
          </div>
          {imgMode === 'url' ? (
            <input className="dash-input" placeholder="https://..." value={form.imagen_url} maxLength={500}
              onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} />
          ) : (
            <div className="dash-file-area" onClick={() => fileInputRef.current?.click()}>
              {uploading ? 'Subiendo...' : form.imagen_url
                ? <><img src={form.imagen_url} alt="preview" className="dash-img-preview" /> <span>Cambiar</span></>
                : '📁 Haz clic para seleccionar una imagen'}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          {form.imagen_url && imgMode === 'url' && <img src={form.imagen_url} alt="preview" className="dash-img-preview" />}
        </div>
        <div className="dash-form-group">
          <label>Categoria</label>
          <select className="dash-input" value={form.categoria_id}
            onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value !== '' ? Number(e.target.value) : '' }))}>
            <option value="">Sin categoria</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Cantidad de perfumes *</label>
            <input className="dash-input" type="number" min="1" required value={form.cantidad}
              onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
          </div>
          <div className="dash-form-group">
            <label>Precio (COP) *</label>
            <input className="dash-input" type="number" min="0" required value={form.precio}
              onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
          </div>
        </div>
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Descuento (%)</label>
            <input className="dash-input" type="number" min="0" max="100" value={form.descuento}
              onChange={e => setForm(f => ({ ...f, descuento: e.target.value }))} />
          </div>
          <div className="dash-form-group">
            <label>Estado</label>
            <select className="dash-input" value={form.activo ? 'true' : 'false'}
              onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'true' }))}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        {formError && <p className="dash-error">{formError}</p>}
      </Modal>
    </>
  );
}
