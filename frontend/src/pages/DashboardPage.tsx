import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Perfume } from '../domain/entities/perfume.schema';
import type { Combo } from '../domain/entities/combo.schema';
import { BASE_URL, JSON_HEADERS } from '../infrastructure/api/client';
import Paginator from '../components/Paginator';
import '../styles/dashboard.css';
import { useAuthContext } from '../application/context/useAuthContext';

const DASH_PAGE_SIZE = 20;
const API_COMBOS = `${BASE_URL}/api/combos`;

const API = `${BASE_URL}/api/parfums`;

interface Lookup { id: number; nombre: string; }

interface PerfumeForm {
  nombre: string;
  descripcion: string;
  precio: string;
  duracion: string;
  proyeccion: string;
  imagen_url: string;
  genero: 'hombre' | 'mujer' | '';
  categoria_id: number | '';
  tipos_aroma: number[];
  ocasiones: number[];
}

const emptyForm = (): PerfumeForm => ({
  nombre: '', descripcion: '', precio: '', duracion: '',
  proyeccion: '', imagen_url: '', genero: '', categoria_id: '',
  tipos_aroma: [], ocasiones: [],
});

type Tab = 'perfumes' | 'aromas' | 'ocasiones' | 'categorias' | 'combos' | 'descuentos';

interface ComboForm {
  nombre: string;
  descripcion: string;
  imagen_url: string;
  categoria_id: number | '';
  cantidad: string;
  precio: string;
  descuento: string;
  activo: boolean;
}

const emptyComboForm = (): ComboForm => ({
  nombre: '', descripcion: '', imagen_url: '', categoria_id: '', cantidad: '2', precio: '', descuento: '0', activo: true,
});

export default function DashboardPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('perfumes');
  const [perfPage, setPerfPage] = useState(1);
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [aromas, setAromas] = useState<Lookup[]>([]);
  const [ocasiones, setOcasiones] = useState<Lookup[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);

  // Combo modal
  const [comboModal, setComboModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [comboForm, setComboForm] = useState<ComboForm>(emptyComboForm());
  const [comboFormLoading, setComboFormLoading] = useState(false);
  const [comboFormError, setComboFormError] = useState('');
  const [comboImgMode, setComboImgMode] = useState<'url' | 'file'>('url');
  const [comboUploading, setComboUploading] = useState(false);
  const comboFileInputRef = useRef<HTMLInputElement>(null);

  // Descuentos inline editing
  const [discountEdits, setDiscountEdits] = useState<Record<string, string>>({});

  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({
    open: false,
    editId: null,
  });
  const [form, setForm] = useState<PerfumeForm>(emptyForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [imgMode, setImgMode] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newAroma, setNewAroma] = useState('');
  const [newOcasion, setNewOcasion] = useState('');
  const [newCategoria, setNewCategoria] = useState('');

  const { user, logout } = useAuthContext();

  useEffect(() => {
    if (!user || user.rol_id !== 1) navigate('/');
  }, [user, navigate]);

  const loadAll = async () => {
    setLoading(true);
    const [pRes, aRes, oRes, cRes, combosRes] = await Promise.all([
      fetch(`${API}/`),
      fetch(`${API}/tipos-aroma`),
      fetch(`${API}/ocasiones`),
      fetch(`${API}/categorias`),
      fetch(API_COMBOS),
    ]);
    const [p, a, o, c, cb] = await Promise.all([
      pRes.json(), aRes.json(), oRes.json(), cRes.json(), combosRes.json(),
    ]);
    setPerfumes(p.data.data ?? []);
    setAromas(a.data ?? []);
    setOcasiones(o.data ?? []);
    setCategorias(c.data ?? []);
    setCombos(cb.data ?? []);
    setPerfPage(1);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError('');
    setImgMode('url');
    setModal({ open: true, editId: null });
  };

  const openEdit = (p: Perfume) => {
    const aromaIds = aromas.filter((a) => p.tipos_aroma.includes(a.nombre)).map((a) => a.id);
    const ocasionIds = ocasiones.filter((o) => p.ocasiones.includes(o.nombre)).map((o) => o.id);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: String(p.precio),
      duracion: p.duracion ?? '',
      proyeccion: p.proyeccion ?? '',
      imagen_url: p.imagen_url ?? '',
      genero: p.genero ?? '',
      categoria_id: p.categoria_id ?? '',
      tipos_aroma: aromaIds,
      ocasiones: ocasionIds,
    });
    setFormError('');
    setImgMode('url');
    setModal({ open: true, editId: p.id });
  };

  const closeModal = () => setModal({ open: false, editId: null });

  const toggleId = (ids: number[], id: number) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

  const setF = (field: keyof PerfumeForm) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleFileUpload = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${BASE_URL}/api/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al subir imagen');
      setForm((f) => ({ ...f, imagen_url: json.url }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir imagen';
      setFormError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.precio) {
      setFormError('Nombre y precio son obligatorios');
      return;
    }
    setFormLoading(true);
    setFormError('');
    const body = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: Number(form.precio),
      duracion: form.duracion || null,
      proyeccion: form.proyeccion || null,
      imagen_url: form.imagen_url || null,
      genero: form.genero || null,
      categoria_id: form.categoria_id !== '' ? Number(form.categoria_id) : null,
      tipos_aroma: form.tipos_aroma,
      ocasiones: form.ocasiones,
    };
    try {
      const url = modal.editId ? `${API}/update/${modal.editId}` : `${API}/create`;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setFormError(json.error ?? 'Error al guardar'); return; }
      closeModal();
      loadAll();
    } catch {
      setFormError('No se pudo conectar con el servidor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletePerfume = async (id: number) => {
    if (!window.confirm('¿Eliminar este perfume? Esta acción no se puede deshacer.')) return;
    await fetch(`${API}/delete/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleAddAroma = async () => {
    if (!newAroma.trim()) return;
    await fetch(`${API}/tipos-aroma`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ nombre: newAroma }),
    });
    setNewAroma('');
    loadAll();
  };

  const handleDeleteAroma = async (id: number) => {
    if (!window.confirm('¿Eliminar este aroma?')) return;
    await fetch(`${API}/tipos-aroma/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleAddOcasion = async () => {
    if (!newOcasion.trim()) return;
    await fetch(`${API}/ocasiones`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ nombre: newOcasion }),
    });
    setNewOcasion('');
    loadAll();
  };

  const handleDeleteOcasion = async (id: number) => {
    if (!window.confirm('¿Eliminar esta ocasión?')) return;
    await fetch(`${API}/ocasiones/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleAddCategoria = async () => {
    if (!newCategoria.trim()) return;
    await fetch(`${API}/categorias`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ nombre: newCategoria }),
    });
    setNewCategoria('');
    loadAll();
  };

  const handleDeleteCategoria = async (id: number) => {
    if (!window.confirm('¿Eliminar esta categoría?')) return;
    await fetch(`${API}/categorias/${id}`, { method: 'DELETE' });
    loadAll();
  };

  // ── Combo handlers ──
  const openCreateCombo = () => {
    setComboForm(emptyComboForm());
    setComboFormError('');
    setComboImgMode('url');
    setComboModal({ open: true, editId: null });
  };

  const openEditCombo = (c: Combo) => {
    setComboForm({
      nombre: c.nombre, descripcion: c.descripcion ?? '',
      imagen_url: c.imagen_url ?? '',
      categoria_id: c.categoria_id ?? '',
      cantidad: String(c.cantidad), precio: String(c.precio),
      descuento: String(c.descuento), activo: c.activo,
    });
    setComboFormError('');
    setComboImgMode('url');
    setComboModal({ open: true, editId: c.id });
  };

  const handleComboFileUpload = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComboUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${BASE_URL}/api/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al subir imagen');
      setComboForm((f) => ({ ...f, imagen_url: json.url }));
    } catch (err) {
      setComboFormError(err instanceof Error ? err.message : 'Error al subir imagen');
    } finally {
      setComboUploading(false);
    }
  };

  const closeComboModal = () => setComboModal({ open: false, editId: null });

  const handleComboSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setComboFormLoading(true);
    setComboFormError('');
    const body = {
      nombre: comboForm.nombre,
      descripcion: comboForm.descripcion || null,
      imagen_url: comboForm.imagen_url || null,
      categoria_id: comboForm.categoria_id !== '' ? Number(comboForm.categoria_id) : null,
      cantidad: Number(comboForm.cantidad),
      precio: Number(comboForm.precio),
      descuento: Number(comboForm.descuento),
      activo: comboForm.activo,
    };
    try {
      const url = comboModal.editId ? `${API_COMBOS}/${comboModal.editId}` : API_COMBOS;
      const method = comboModal.editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setComboFormError(json.error ?? 'Error al guardar'); return; }
      closeComboModal();
      loadAll();
    } catch {
      setComboFormError('No se pudo conectar con el servidor');
    } finally {
      setComboFormLoading(false);
    }
  };

  const handleDeleteCombo = async (id: number) => {
    if (!window.confirm('¿Eliminar este combo?')) return;
    await fetch(`${API_COMBOS}/${id}`, { method: 'DELETE' });
    loadAll();
  };

  // ── Descuento handlers ──
  const saveDescuentoPerfume = async (id: number) => {
    const val = Number(discountEdits[`p-${id}`] ?? 0);
    await fetch(`${API}/${id}/descuento`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ descuento: val }) });
    loadAll();
  };

  const saveDescuentoCombo = async (id: number) => {
    const val = Number(discountEdits[`c-${id}`] ?? 0);
    await fetch(`${API_COMBOS}/${id}/descuento`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ descuento: val }) });
    loadAll();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(price);

  return (
    <div className="dash-root">
      {/* Header */}
      <header className="dash-header">
        <span className="dash-brand">✦ Celestial Parfums</span>
        <div className="dash-header-right">
          <Link to="/catalog" className="dash-btn-ghost">Ver catálogo</Link>
          <button className="dash-btn-ghost" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="dash-tabs">
        {(['perfumes', 'aromas', 'ocasiones', 'categorias', 'combos', 'descuentos'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`dash-tab ${tab === t ? 'dash-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'perfumes'   && '🧴 Perfumes'}
            {t === 'aromas'     && '🌸 Aromas'}
            {t === 'ocasiones'  && '🗓 Ocasiones'}
            {t === 'categorias' && '🏷 Categorías'}
            {t === 'combos'     && '🎁 Combos'}
            {t === 'descuentos' && '🏷 Descuentos'}
          </button>
        ))}
      </nav>

      <main className="dash-main">
        {loading ? (
          <p className="dash-empty">Cargando...</p>
        ) : (
          <>
            {/* PERFUMES */}
            {tab === 'perfumes' && (
              <section className="dash-section">
                <div className="dash-toolbar">
                  <h2 className="dash-section-title">
                    Perfumes <span className="dash-count">{perfumes.length}</span>
                  </h2>
                  <button className="dash-btn-accent" onClick={openCreate}>
                    + Nuevo perfume
                  </button>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Género</th>
                        <th>Categoría</th>
                        <th>Aromas</th>
                        <th>Ocasiones</th>
                        <th>Duración</th>
                        <th>Proyección</th>
                        <th>Imagen</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfumes.slice((perfPage - 1) * DASH_PAGE_SIZE, perfPage * DASH_PAGE_SIZE).map((p) => (
                        <tr key={p.id}>
                          <td className="dash-td-name">{p.nombre}</td>
                          <td className="dash-td-price">{formatPrice(p.precio)}</td>
                          <td className="dash-td-meta">{p.genero ?? '—'}</td>
                          <td className="dash-td-meta">{p.categoria ?? '—'}</td>
                          <td>
                            <div className="dash-tags">
                              {p.tipos_aroma.map((a) => (
                                <span key={a} className="dash-tag">{a}</span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="dash-tags">
                              {p.ocasiones.map((o) => (
                                <span key={o} className="dash-tag dash-tag--oc">{o}</span>
                              ))}
                            </div>
                          </td>
                          <td className="dash-td-meta">{p.duracion ?? '—'}</td>
                          <td className="dash-td-meta">{p.proyeccion ?? '—'}</td>
                          <td className="dash-td-meta">
                            {p.imagen_url
                              ? <img src={p.imagen_url} alt={p.nombre} className="dash-thumb" />
                              : '—'}
                          </td>
                          <td className="dash-td-actions">
                            <button
                              className="dash-icon-btn"
                              onClick={() => openEdit(p)}
                              title="Editar"
                            >✏️</button>
                            <button
                              className="dash-icon-btn"
                              onClick={() => handleDeletePerfume(p.id)}
                              title="Eliminar"
                            >🗑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Paginator
                  page={perfPage}
                  total={perfumes.length}
                  pageSize={DASH_PAGE_SIZE}
                  onChange={setPerfPage}
                  className="dash-pagination"
                />
              </section>
            )}

            {/* AROMAS */}
            {tab === 'aromas' && (
              <section className="dash-section">
                <div className="dash-toolbar">
                  <h2 className="dash-section-title">
                    Tipos de Aroma <span className="dash-count">{aromas.length}</span>
                  </h2>
                </div>
                <div className="dash-add-row">
                  <input
                    className="dash-input"
                    placeholder="Nuevo aroma..."
                    value={newAroma}
                    onChange={(e) => setNewAroma(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAroma()}
                  />
                  <button className="dash-btn-accent" onClick={handleAddAroma}>Agregar</button>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead><tr><th>#</th><th>Nombre</th><th></th></tr></thead>
                    <tbody>
                      {aromas.map((a) => (
                        <tr key={a.id}>
                          <td className="dash-td-id">{a.id}</td>
                          <td>{a.nombre}</td>
                          <td className="dash-td-actions">
                            <button className="dash-icon-btn" onClick={() => handleDeleteAroma(a.id)} title="Eliminar">🗑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* OCASIONES */}
            {tab === 'ocasiones' && (
              <section className="dash-section">
                <div className="dash-toolbar">
                  <h2 className="dash-section-title">
                    Ocasiones <span className="dash-count">{ocasiones.length}</span>
                  </h2>
                </div>
                <div className="dash-add-row">
                  <input
                    className="dash-input"
                    placeholder="Nueva ocasión..."
                    value={newOcasion}
                    onChange={(e) => setNewOcasion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOcasion()}
                  />
                  <button className="dash-btn-accent" onClick={handleAddOcasion}>Agregar</button>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead><tr><th>#</th><th>Nombre</th><th></th></tr></thead>
                    <tbody>
                      {ocasiones.map((o) => (
                        <tr key={o.id}>
                          <td className="dash-td-id">{o.id}</td>
                          <td>{o.nombre}</td>
                          <td className="dash-td-actions">
                            <button className="dash-icon-btn" onClick={() => handleDeleteOcasion(o.id)} title="Eliminar">🗑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* COMBOS */}
            {tab === 'combos' && (
              <section className="dash-section">
                <div className="dash-toolbar">
                  <h2 className="dash-section-title">
                    Combos <span className="dash-count">{combos.length}</span>
                  </h2>
                  <button className="dash-btn-accent" onClick={openCreateCombo}>+ Nuevo combo</button>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Nombre</th>
                        <th>Perfumes</th>
                        <th>Precio</th>
                        <th>Descuento</th>
                        <th>Precio final</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {combos.map((c) => {
                        const final = c.descuento > 0 ? Math.round(c.precio * (1 - c.descuento / 100)) : c.precio;
                        return (
                          <tr key={c.id}>
                            <td className="dash-td-meta">
                              {c.imagen_url
                                ? <img src={c.imagen_url} alt={c.nombre} className="dash-thumb" />
                                : '—'}
                            </td>
                            <td className="dash-td-name">
                              {c.nombre}
                              {c.descripcion && <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 400 }}>{c.descripcion}</div>}
                            </td>
                            <td className="dash-td-meta">{c.cantidad} perfumes</td>
                            <td className="dash-td-price">{formatPrice(c.precio)}</td>
                            <td className="dash-td-meta">{c.descuento > 0 ? `${c.descuento}%` : '—'}</td>
                            <td className="dash-td-price">{c.descuento > 0 ? formatPrice(final) : '—'}</td>
                            <td>
                              <span className={`dash-tag ${c.activo ? 'dash-tag--oc' : ''}`}>
                                {c.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="dash-td-actions">
                              <button className="dash-icon-btn" onClick={() => openEditCombo(c)} title="Editar">✏️</button>
                              <button className="dash-icon-btn" onClick={() => handleDeleteCombo(c.id)} title="Eliminar">🗑</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* DESCUENTOS */}
            {tab === 'descuentos' && (
              <section className="dash-section">
                <h2 className="dash-section-title" style={{ marginBottom: 4 }}>Descuentos</h2>
                <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 16px' }}>
                  Edita el % de descuento de cada perfume o combo. El precio con descuento se calcula automáticamente.
                </p>

                {/* Perfumes */}
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
                  Perfumes <span className="dash-count">{perfumes.filter(p => p.descuento > 0).length} con descuento</span>
                </h3>
                <div className="dash-table-wrap" style={{ marginBottom: 24 }}>
                  <table className="dash-table">
                    <thead><tr><th>Perfume</th><th>Precio</th><th>Descuento %</th><th>Precio final</th><th></th></tr></thead>
                    <tbody>
                      {perfumes.map((p) => {
                        const key = `p-${p.id}`;
                        const val = discountEdits[key] ?? String(p.descuento);
                        const final = Number(val) > 0 ? Math.round(p.precio * (1 - Number(val) / 100)) : p.precio;
                        return (
                          <tr key={p.id}>
                            <td className="dash-td-name">{p.nombre}</td>
                            <td className="dash-td-price">{formatPrice(p.precio)}</td>
                            <td style={{ width: 110 }}>
                              <input
                                className="dash-input"
                                type="number" min="0" max="100"
                                value={val}
                                onChange={(e) => setDiscountEdits(prev => ({ ...prev, [key]: e.target.value }))}
                                style={{ width: 80 }}
                              />
                            </td>
                            <td className="dash-td-price">
                              {Number(val) > 0 ? formatPrice(final) : '—'}
                            </td>
                            <td className="dash-td-actions">
                              <button className="dash-btn-accent" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => saveDescuentoPerfume(p.id)}>
                                Guardar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Combos */}
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
                  Combos <span className="dash-count">{combos.filter(c => c.descuento > 0).length} con descuento</span>
                </h3>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead><tr><th>Combo</th><th>Precio</th><th>Descuento %</th><th>Precio final</th><th></th></tr></thead>
                    <tbody>
                      {combos.map((c) => {
                        const key = `c-${c.id}`;
                        const val = discountEdits[key] ?? String(c.descuento);
                        const final = Number(val) > 0 ? Math.round(c.precio * (1 - Number(val) / 100)) : c.precio;
                        return (
                          <tr key={c.id}>
                            <td className="dash-td-name">{c.nombre}</td>
                            <td className="dash-td-price">{formatPrice(c.precio)}</td>
                            <td style={{ width: 110 }}>
                              <input
                                className="dash-input"
                                type="number" min="0" max="100"
                                value={val}
                                onChange={(e) => setDiscountEdits(prev => ({ ...prev, [key]: e.target.value }))}
                                style={{ width: 80 }}
                              />
                            </td>
                            <td className="dash-td-price">
                              {Number(val) > 0 ? formatPrice(final) : '—'}
                            </td>
                            <td className="dash-td-actions">
                              <button className="dash-btn-accent" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => saveDescuentoCombo(c.id)}>
                                Guardar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* CATEGORÍAS */}
            {tab === 'categorias' && (
              <section className="dash-section">
                <div className="dash-toolbar">
                  <h2 className="dash-section-title">
                    Categorías <span className="dash-count">{categorias.length}</span>
                  </h2>
                </div>
                <div className="dash-add-row">
                  <input
                    className="dash-input"
                    placeholder="Nueva categoría..."
                    value={newCategoria}
                    onChange={(e) => setNewCategoria(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategoria()}
                  />
                  <button className="dash-btn-accent" onClick={handleAddCategoria}>Agregar</button>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead><tr><th>#</th><th>Nombre</th><th></th></tr></thead>
                    <tbody>
                      {categorias.map((c) => (
                        <tr key={c.id}>
                          <td className="dash-td-id">{c.id}</td>
                          <td>{c.nombre}</td>
                          <td className="dash-td-actions">
                            <button className="dash-icon-btn" onClick={() => handleDeleteCategoria(c.id)} title="Eliminar">🗑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Modal perfume */}
      {modal.open && (
        <div className="dash-overlay" onClick={closeModal}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-header">
              <h3>{modal.editId ? 'Editar perfume' : 'Nuevo perfume'}</h3>
              <button className="dash-modal-close" onClick={closeModal}>✕</button>
            </div>

            <form className="dash-modal-form" onSubmit={handleFormSubmit}>
              <div className="dash-form-row">
                <div className="dash-form-group">
                  <label>Nombre *</label>
                  <input className="dash-input" value={form.nombre} onChange={setF('nombre')} required />
                </div>
                <div className="dash-form-group">
                  <label>Precio (COP) *</label>
                  <input className="dash-input" type="number" min="0" value={form.precio} onChange={setF('precio')} required />
                </div>
              </div>

              <div className="dash-form-group">
                <label>Descripción</label>
                <textarea className="dash-input dash-textarea" value={form.descripcion} onChange={setF('descripcion')} rows={2} />
              </div>

              <div className="dash-form-row">
                <div className="dash-form-group">
                  <label>Duración</label>
                  <input className="dash-input" placeholder="ej: 6-8 horas" value={form.duracion} onChange={setF('duracion')} />
                </div>
                <div className="dash-form-group">
                  <label>Proyección</label>
                  <input className="dash-input" placeholder="ej: Moderada" value={form.proyeccion} onChange={setF('proyeccion')} />
                </div>
              </div>

              <div className="dash-form-row">
                <div className="dash-form-group">
                  <label>Género</label>
                  <select
                    className="dash-input"
                    value={form.genero}
                    onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value as PerfumeForm['genero'] }))}
                  >
                    <option value="">— Sin especificar —</option>
                    <option value="hombre">Hombre</option>
                    <option value="mujer">Mujer</option>
                  </select>
                </div>
                <div className="dash-form-group">
                  <label>Categoría</label>
                  <select
                    className="dash-input"
                    value={form.categoria_id}
                    onChange={(e) => setForm((f) => ({ ...f, categoria_id: e.target.value === '' ? '' : Number(e.target.value) }))}
                  >
                    <option value="">— Sin especificar —</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Imagen */}
              <div className="dash-form-group">
                <label>Imagen</label>
                <div className="dash-img-toggle">
                  <button
                    type="button"
                    className={`dash-img-tab ${imgMode === 'url' ? 'dash-img-tab--active' : ''}`}
                    onClick={() => setImgMode('url')}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    className={`dash-img-tab ${imgMode === 'file' ? 'dash-img-tab--active' : ''}`}
                    onClick={() => { setImgMode('file'); fileInputRef.current?.click(); }}
                  >
                    Subir archivo
                  </button>
                </div>

                {imgMode === 'url' ? (
                  <input
                    className="dash-input"
                    placeholder="https://..."
                    value={form.imagen_url}
                    onChange={setF('imagen_url')}
                  />
                ) : (
                  <div className="dash-file-area" onClick={() => fileInputRef.current?.click()}>
                    {uploading
                      ? 'Subiendo...'
                      : form.imagen_url
                        ? <><img src={form.imagen_url} alt="preview" className="dash-img-preview" /> <span>Cambiar</span></>
                        : '📁 Haz clic para seleccionar una imagen'}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />

                {form.imagen_url && imgMode === 'url' && (
                  <img src={form.imagen_url} alt="preview" className="dash-img-preview" />
                )}
              </div>

              <div className="dash-form-row">
                <div className="dash-form-group">
                  <label>Tipos de aroma</label>
                  <div className="dash-checks">
                    {aromas.map((a) => (
                      <label key={a.id} className="dash-check">
                        <input
                          type="checkbox"
                          checked={form.tipos_aroma.includes(a.id)}
                          onChange={() => setForm((f) => ({ ...f, tipos_aroma: toggleId(f.tipos_aroma, a.id) }))}
                        />
                        {a.nombre}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="dash-form-group">
                  <label>Ocasiones</label>
                  <div className="dash-checks">
                    {ocasiones.map((o) => (
                      <label key={o.id} className="dash-check">
                        <input
                          type="checkbox"
                          checked={form.ocasiones.includes(o.id)}
                          onChange={() => setForm((f) => ({ ...f, ocasiones: toggleId(f.ocasiones, o.id) }))}
                        />
                        {o.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {formError && <p className="dash-error">{formError}</p>}

              <div className="dash-modal-footer">
                <button type="button" className="dash-btn-ghost" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="dash-btn-accent" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Crear perfume'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal combo */}
      {comboModal.open && (
        <div className="dash-overlay" onClick={closeComboModal}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-header">
              <h3>{comboModal.editId ? 'Editar combo' : 'Nuevo combo'}</h3>
              <button className="dash-modal-close" onClick={closeComboModal}>✕</button>
            </div>
            <form className="dash-modal-form" onSubmit={handleComboSubmit}>
              <div className="dash-form-group">
                <label>Nombre *</label>
                <input className="dash-input" value={comboForm.nombre} required
                  onChange={(e) => setComboForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="dash-form-group">
                <label>Descripción</label>
                <textarea className="dash-input dash-textarea" rows={2} value={comboForm.descripcion}
                  onChange={(e) => setComboForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="dash-form-group">
                <label>Imagen</label>
                <div className="dash-img-toggle">
                  <button
                    type="button"
                    className={`dash-img-tab ${comboImgMode === 'url' ? 'dash-img-tab--active' : ''}`}
                    onClick={() => setComboImgMode('url')}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    className={`dash-img-tab ${comboImgMode === 'file' ? 'dash-img-tab--active' : ''}`}
                    onClick={() => { setComboImgMode('file'); comboFileInputRef.current?.click(); }}
                  >
                    Subir archivo
                  </button>
                </div>
                {comboImgMode === 'url' ? (
                  <input
                    className="dash-input"
                    placeholder="https://..."
                    value={comboForm.imagen_url}
                    onChange={(e) => setComboForm(f => ({ ...f, imagen_url: e.target.value }))}
                  />
                ) : (
                  <div className="dash-file-area" onClick={() => comboFileInputRef.current?.click()}>
                    {comboUploading
                      ? 'Subiendo...'
                      : comboForm.imagen_url
                        ? <><img src={comboForm.imagen_url} alt="preview" className="dash-img-preview" /> <span>Cambiar</span></>
                        : '📁 Haz clic para seleccionar una imagen'}
                  </div>
                )}
                <input
                  ref={comboFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleComboFileUpload}
                />
                {comboForm.imagen_url && comboImgMode === 'url' && (
                  <img src={comboForm.imagen_url} alt="preview" className="dash-img-preview" />
                )}
              </div>
              <div className="dash-form-group">
                <label>Categoría</label>
                <select className="dash-input" value={comboForm.categoria_id}
                  onChange={(e) => setComboForm(f => ({ ...f, categoria_id: e.target.value !== '' ? Number(e.target.value) : '' }))}>
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="dash-form-row">
                <div className="dash-form-group">
                  <label>Cantidad de perfumes *</label>
                  <input className="dash-input" type="number" min="1" required value={comboForm.cantidad}
                    onChange={(e) => setComboForm(f => ({ ...f, cantidad: e.target.value }))} />
                </div>
                <div className="dash-form-group">
                  <label>Precio (COP) *</label>
                  <input className="dash-input" type="number" min="0" required value={comboForm.precio}
                    onChange={(e) => setComboForm(f => ({ ...f, precio: e.target.value }))} />
                </div>
              </div>
              <div className="dash-form-row">
                <div className="dash-form-group">
                  <label>Descuento (%)</label>
                  <input className="dash-input" type="number" min="0" max="100" value={comboForm.descuento}
                    onChange={(e) => setComboForm(f => ({ ...f, descuento: e.target.value }))} />
                </div>
                <div className="dash-form-group">
                  <label>Estado</label>
                  <select className="dash-input" value={comboForm.activo ? 'true' : 'false'}
                    onChange={(e) => setComboForm(f => ({ ...f, activo: e.target.value === 'true' }))}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              {comboFormError && <p className="dash-error">{comboFormError}</p>}
              <div className="dash-modal-footer">
                <button type="button" className="dash-btn-ghost" onClick={closeComboModal}>Cancelar</button>
                <button type="submit" className="dash-btn-accent" disabled={comboFormLoading}>
                  {comboFormLoading ? 'Guardando...' : comboModal.editId ? 'Guardar cambios' : 'Crear combo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
