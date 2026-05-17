import { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Modal from '../../../components/Modal';
import { SmartTable } from '../../../components/table/SmartTable';
import { ventasColumns } from '../columns';
import { API_VENTAS, DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
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

  const load = async (p = page, s = pageSize) => {
    const [vRes, tRes] = await Promise.all([
      guardedFetch(`${API_VENTAS}?page=${p}&limit=${s}`),
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
      <section className="dash-section">
        <div className="dash-toolbar">
          <h2 className="dash-section-title">Ventas <span className="dash-count">{total}</span></h2>
          <button className="dash-btn-accent" onClick={openCreate}>+ Registrar venta</button>
        </div>
        {totales && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Total unidades vendidas</span>
              <span className="dash-stat-value">{totales.total_unidades}</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Total en dinero</span>
              <span className="dash-stat-value">{formatPrice(totales.total_dinero)}</span>
            </div>
          </div>
        )}
        <SmartTable
          columns={ventasColumns}
          rows={ventas}
          rowKey={v => v.id}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={v => (
            <>
              <button className="dash-icon-btn" onClick={() => openEdit(v)} title="Editar"><FiEdit2 /></button>
              <button className="dash-icon-btn" onClick={() => handleDelete(v.id)} title="Eliminar"><FiTrash2 /></button>
            </>
          )}
        />
      </section>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar venta' : 'Registrar venta'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Registrar'}
        loading={loading}
      >
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Dia *</label>
            <input className="dash-input" type="date" required value={form.dia}
              onChange={e => setForm(f => ({ ...f, dia: e.target.value }))} />
          </div>
          <div className="dash-form-group">
            <label>Persona *</label>
            <input className="dash-input" required value={form.persona} maxLength={100}
              onChange={e => setForm(f => ({ ...f, persona: e.target.value }))} />
          </div>
        </div>
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Cantidad *</label>
            <input className="dash-input" type="number" min="1" required value={form.cantidad_perfumes}
              onChange={e => setForm(f => ({ ...f, cantidad_perfumes: e.target.value }))} />
          </div>
          <div className="dash-form-group">
            <label>Presentacion *</label>
            <select className="dash-input" value={form.presentacion}
              onChange={e => setForm(f => ({ ...f, presentacion: e.target.value }))}>
              {['10ML','20ML','30ML','60ML','100ML','200ML'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="dash-form-group">
          <label>Referencia(s) de perfume *</label>
          <input className="dash-input" required placeholder="Ej: Invictus, Sauvage" value={form.referencia_perfume} maxLength={200}
            onChange={e => setForm(f => ({ ...f, referencia_perfume: e.target.value }))} />
        </div>
        <div className="dash-form-group">
          <label>Valor venta (COP) *</label>
          <input className="dash-input" type="number" min="0" required value={form.valor_venta}
            onChange={e => setForm(f => ({ ...f, valor_venta: e.target.value }))} />
        </div>
        <div className="dash-form-group">
          <label>Datos adicionales</label>
          <textarea className="dash-input dash-textarea" rows={2} value={form.datos_adicionales} maxLength={300}
            onChange={e => setForm(f => ({ ...f, datos_adicionales: e.target.value }))} />
        </div>
        {error && <p className="dash-error">{error}</p>}
      </Modal>
    </>
  );
}
