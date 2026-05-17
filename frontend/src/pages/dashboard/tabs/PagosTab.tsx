import { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Modal from '../../../components/Modal';
import { SmartTable } from '../../../components/table/SmartTable';
import { pagosColumns } from '../columns';
import { API_PAGOS, API_EMPRESAS, DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
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

  const load = async (p = page, s = pageSize) => {
    const [pRes, tRes, eRes] = await Promise.all([
      guardedFetch(`${API_PAGOS}?page=${p}&limit=${s}`),
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
      <section className="dash-section">
        <div className="dash-toolbar">
          <h2 className="dash-section-title">Pagos a Proveedores <span className="dash-count">{total}</span></h2>
          <button className="dash-btn-accent" onClick={openCreate}>+ Registrar pago</button>
        </div>
        {totales && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Total en compras</span>
              <span className="dash-stat-value">{formatPrice(totales.total_compras)}</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Total en envios</span>
              <span className="dash-stat-value">{formatPrice(totales.total_envios)}</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Total general</span>
              <span className="dash-stat-value">{formatPrice(totales.total_compras + totales.total_envios)}</span>
            </div>
          </div>
        )}
        <SmartTable
          columns={pagosColumns}
          rows={pagos}
          rowKey={p => p.id}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={p => (
            <>
              <button className="dash-icon-btn" onClick={() => openEdit(p)} title="Editar"><FiEdit2 /></button>
              <button className="dash-icon-btn" onClick={() => handleDelete(p.id)} title="Eliminar"><FiTrash2 /></button>
            </>
          )}
        />
      </section>

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar pago' : 'Registrar pago a proveedor'}
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
            <label>Valor compra (COP) *</label>
            <input className="dash-input" type="number" min="0" required value={form.valor_compra}
              onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))} />
          </div>
        </div>
        <div className="dash-form-group">
          <label>Empresa *</label>
          <select className="dash-input" value={String(form.empresa_id)}
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, empresa_id: val === '' ? '' : val === 'nuevo' ? 'nuevo' : Number(val) }));
            }}>
            <option value="">— Selecciona una empresa —</option>
            {!modal.editId && <option value="nuevo">+ Registrar empresa nueva</option>}
            {empresas.map(em => <option key={em.id} value={em.id}>{em.nombre}{em.nit ? ` · NIT: ${em.nit}` : ''}</option>)}
          </select>
        </div>
        {form.empresa_id === 'nuevo' && (
          <div className="dash-inline-form">
            <div className="dash-form-row">
              <div className="dash-form-group">
                <label>Nombre empresa *</label>
                <input className="dash-input" value={form.nueva_nombre} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nueva_nombre: e.target.value }))} />
              </div>
              <div className="dash-form-group">
                <label>NIT</label>
                <input className="dash-input" value={form.nueva_nit} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nueva_nit: e.target.value }))} />
              </div>
            </div>
            <div className="dash-form-row">
              <div className="dash-form-group">
                <label>Telefono</label>
                <input className="dash-input" value={form.nueva_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nueva_telefono: e.target.value }))} />
              </div>
              <div className="dash-form-group">
                <label>Correo</label>
                <input className="dash-input" type="email" value={form.nueva_correo} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nueva_correo: e.target.value }))} />
              </div>
            </div>
            <div className="dash-form-group">
              <label>Direccion</label>
              <input className="dash-input" value={form.nueva_direccion} maxLength={150}
                onChange={e => setForm(f => ({ ...f, nueva_direccion: e.target.value }))} />
            </div>
          </div>
        )}
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Costo de envio (COP)</label>
            <input className="dash-input" type="number" min="0" value={form.coste_envio}
              onChange={e => setForm(f => ({ ...f, coste_envio: e.target.value }))} />
          </div>
        </div>
        <div className="dash-form-group">
          <label>Detalles adicionales</label>
          <textarea className="dash-input dash-textarea" rows={2} value={form.detalles_adicionales} maxLength={300}
            onChange={e => setForm(f => ({ ...f, detalles_adicionales: e.target.value }))} />
        </div>
        {error && <p className="dash-error">{error}</p>}
      </Modal>
    </>
  );
}
