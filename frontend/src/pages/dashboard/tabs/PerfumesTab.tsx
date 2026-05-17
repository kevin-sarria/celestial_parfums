import { useRef, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Modal from '../../../components/Modal';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { SmartTable } from '../../../components/table/SmartTable';
import { perfumesColumns } from '../columns';
import { API } from '../helpers';
import { BASE_URL } from '../../../infrastructure/api/client';
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
  onMutate: () => void;
}

export function PerfumesTab({
  perfumes, page, total, pageSize, aromas, ocasiones, categorias, presentaciones,
  guardedFetch, onPageChange, onPageSizeChange, onMutate,
}: PerfumesTabProps) {
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<PerfumeForm>(emptyPerfumeForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [imgMode, setImgMode] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
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
      const fd = new FormData();
      fd.append('image', file);
      const res = await guardedFetch(`${BASE_URL}/api/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al subir imagen');
      setForm(f => ({ ...f, imagen_url: json.url }));
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
      <section className="dash-section">
        <div className="dash-toolbar">
          <h2 className="dash-section-title">Perfumes <span className="dash-count">{perfumes.length}</span></h2>
          <button className="dash-btn-accent" onClick={openCreate}>+ Nuevo perfume</button>
        </div>
        <SmartTable
          columns={perfumesColumns}
          rows={perfumes}
          rowKey={p => p.id}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          renderActions={p => (
            <>
              <button
                className={`dash-tag${p.agotado ? '' : ' dash-tag--oc'}`}
                style={{ cursor: 'pointer', border: 'none', fontWeight: 600, marginRight: 4 }}
                onClick={() => handleToggleAgotado(p)}
                title="Cambiar stock"
              >
                {p.agotado ? 'Agotado' : 'En stock'}
              </button>
              {p.imagen_url && <img src={p.imagen_url} alt={p.nombre} className="dash-thumb" style={{ marginRight: 4 }} />}
              <button className="dash-icon-btn" onClick={() => openEdit(p)} title="Editar"><FiEdit2 /></button>
              <button className="dash-icon-btn" onClick={() => handleDelete(p.id)} title="Eliminar"><FiTrash2 /></button>
            </>
          )}
        />
      </section>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar perfume' : 'Nuevo perfume'}
        onSubmit={handleSubmit}
        submitLabel={formLoading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Crear perfume'}
        loading={formLoading}
      >
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Nombre *</label>
            <input className="dash-input" value={form.nombre} onChange={setF('nombre')} required maxLength={100} />
          </div>
          <div className="dash-form-group">
            <label>Precio (COP) *</label>
            <input className="dash-input" type="number" min="0" value={form.precio} onChange={setF('precio')} required />
          </div>
        </div>
        <div className="dash-form-group">
          <label>Descripcion</label>
          <textarea className="dash-input dash-textarea" value={form.descripcion} onChange={setF('descripcion')} rows={2} maxLength={500} />
        </div>
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Duracion</label>
            <input className="dash-input" placeholder="ej: 6-8 horas" value={form.duracion} onChange={setF('duracion')} maxLength={50} />
          </div>
          <div className="dash-form-group">
            <label>Proyeccion</label>
            <input className="dash-input" placeholder="ej: Moderada" value={form.proyeccion} onChange={setF('proyeccion')} maxLength={50} />
          </div>
        </div>
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Genero</label>
            <select className="dash-input" value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value as PerfumeForm['genero'] }))}>
              <option value="">— Sin especificar —</option>
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
            </select>
          </div>
          <div className="dash-form-group">
            <label>Categoria</label>
            <select className="dash-input" value={form.categoria_id}
              onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value === '' ? '' : Number(e.target.value) }))}>
              <option value="">— Sin especificar —</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="dash-form-group">
          <label>Imagen</label>
          <div className="dash-img-toggle">
            <button type="button" className={`dash-img-tab${imgMode === 'url' ? ' dash-img-tab--active' : ''}`} onClick={() => setImgMode('url')}>URL</button>
            <button type="button" className={`dash-img-tab${imgMode === 'file' ? ' dash-img-tab--active' : ''}`} onClick={() => { setImgMode('file'); fileInputRef.current?.click(); }}>Subir archivo</button>
          </div>
          {imgMode === 'url' ? (
            <input className="dash-input" placeholder="https://..." value={form.imagen_url} onChange={setF('imagen_url')} maxLength={500} />
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
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Tipos de aroma</label>
            <div className="dash-checks">
              {aromas.map(a => (
                <label key={a.id} className="dash-check">
                  <input type="checkbox" checked={form.tipos_aroma.includes(a.id)} onChange={() => setForm(f => ({ ...f, tipos_aroma: toggleId(f.tipos_aroma, a.id) }))} />
                  {a.nombre}
                </label>
              ))}
            </div>
          </div>
          <div className="dash-form-group">
            <label>Ocasiones</label>
            <div className="dash-checks">
              {ocasiones.map(o => (
                <label key={o.id} className="dash-check">
                  <input type="checkbox" checked={form.ocasiones.includes(o.id)} onChange={() => setForm(f => ({ ...f, ocasiones: toggleId(f.ocasiones, o.id) }))} />
                  {o.nombre}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="dash-form-group">
          <label>Presentaciones disponibles</label>
          <div className="dash-checks">
            {presentaciones.map(p => (
              <label key={p.id} className="dash-check">
                <input type="checkbox" checked={form.presentaciones.includes(p.id)} onChange={() => setForm(f => ({ ...f, presentaciones: toggleId(f.presentaciones, p.id) }))} />
                {p.nombre}
              </label>
            ))}
          </div>
        </div>
        {formError && <p className="dash-error">{formError}</p>}
      </Modal>
    </>
  );
}
