import { useEffect, useState } from 'react';
import { FiDollarSign, FiTrash2 } from 'react-icons/fi';
import Modal from '../../../components/Modal';
import { SmartTable } from '../../../components/table/SmartTable';
import { creditosColumns } from '../columns';
import { API_CREDITOS, API_CLIENTES, DEFAULT_PAGE_SIZE } from '../helpers';
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

  const [abonoModal, setAbonoModal] = useState<{ open: boolean; creditoId: number | null }>({ open: false, creditoId: null });
  const [abonoMonto, setAbonoMonto] = useState('');

  const load = async (p = page, s = pageSize) => {
    const [cRes, clRes] = await Promise.all([
      guardedFetch(`${API_CREDITOS}?page=${p}&limit=${s}`),
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
      <section className="dash-section">
        <div className="dash-toolbar">
          <h2 className="dash-section-title">Creditos <span className="dash-count">{total}</span></h2>
          <button className="dash-btn-accent" onClick={() => { setForm(emptyCreditoForm()); setError(''); setModal(true); }}>
            + Nuevo credito
          </button>
        </div>
        <SmartTable
          columns={creditosColumns}
          rows={creditos}
          rowKey={c => c.id}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={c => (
            <>
              <button className="dash-icon-btn" title="Registrar abono"
                onClick={() => { setAbonoModal({ open: true, creditoId: c.id }); setAbonoMonto(''); }}>
                <FiDollarSign />
              </button>
              <button className="dash-icon-btn" onClick={() => handleDelete(c.id)} title="Eliminar"><FiTrash2 /></button>
            </>
          )}
        />
      </section>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nuevo credito"
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : 'Registrar credito'}
        loading={loading}
      >
        <div className="dash-form-row">
          <div className="dash-form-group">
            <label>Fecha *</label>
            <input className="dash-input" type="date" required value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          </div>
          <div className="dash-form-group">
            <label>Deuda inicial (COP) *</label>
            <input className="dash-input" type="number" min="1" required value={form.deuda_inicial}
              onChange={e => setForm(f => ({ ...f, deuda_inicial: e.target.value }))} />
          </div>
        </div>
        <div className="dash-form-group">
          <label>Cliente *</label>
          <select className="dash-input" value={String(form.cliente_id)}
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, cliente_id: val === '' ? '' : val === 'nuevo' ? 'nuevo' : Number(val) }));
            }}>
            <option value="">— Selecciona un cliente —</option>
            <option value="nuevo">+ Crear cliente nuevo</option>
            {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.nombre} {cl.apellido}{cl.telefono ? ` · ${cl.telefono}` : ''}</option>)}
          </select>
        </div>
        {form.cliente_id === 'nuevo' && (
          <div className="dash-inline-form">
            <div className="dash-form-row">
              <div className="dash-form-group">
                <label>Nombre *</label>
                <input className="dash-input" value={form.nuevo_nombre} maxLength={60}
                  onChange={e => setForm(f => ({ ...f, nuevo_nombre: e.target.value }))} />
              </div>
              <div className="dash-form-group">
                <label>Apellido *</label>
                <input className="dash-input" value={form.nuevo_apellido} maxLength={60}
                  onChange={e => setForm(f => ({ ...f, nuevo_apellido: e.target.value }))} />
              </div>
            </div>
            <div className="dash-form-row">
              <div className="dash-form-group">
                <label>Telefono</label>
                <input className="dash-input" value={form.nuevo_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nuevo_telefono: e.target.value }))} />
              </div>
              <div className="dash-form-group">
                <label>Correo</label>
                <input className="dash-input" type="email" value={form.nuevo_correo} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nuevo_correo: e.target.value }))} />
              </div>
            </div>
            <div className="dash-form-group">
              <label>Direccion</label>
              <input className="dash-input" value={form.nuevo_direccion} maxLength={150}
                onChange={e => setForm(f => ({ ...f, nuevo_direccion: e.target.value }))} />
            </div>
          </div>
        )}
        <div className="dash-form-group">
          <label>Articulos *</label>
          <textarea className="dash-input dash-textarea" rows={2} required value={form.articulos} maxLength={300}
            onChange={e => setForm(f => ({ ...f, articulos: e.target.value }))} />
        </div>
        {error && <p className="dash-error">{error}</p>}
      </Modal>

      <Modal
        open={abonoModal.open}
        onClose={() => setAbonoModal({ open: false, creditoId: null })}
        title="Registrar abono"
        maxWidth={360}
        footer={
          <div className="dash-modal-footer">
            <button className="dash-btn-ghost" onClick={() => setAbonoModal({ open: false, creditoId: null })}>Cancelar</button>
            <button className="dash-btn-accent" onClick={handleAbono} disabled={!abonoMonto}>Guardar abono</button>
          </div>
        }
      >
        <div className="dash-form-group">
          <label>Monto del abono (COP)</label>
          <input className="dash-input" type="number" min="1" value={abonoMonto}
            onChange={e => setAbonoMonto(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAbono()} />
        </div>
      </Modal>
    </>
  );
}
