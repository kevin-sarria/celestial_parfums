import { useState } from 'react';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import { formatPrice, API, API_COMBOS } from '../helpers';
import type { GuardedFetch } from '../types';

interface DescuentosTabProps {
  perfumes: Perfume[];
  combos: Combo[];
  guardedFetch: GuardedFetch;
  onMutate: () => void;
}

export function DescuentosTab({ perfumes, combos, guardedFetch, onMutate }: DescuentosTabProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});

  const savePerfume = async (id: number) => {
    const val = Number(edits[`p-${id}`] ?? 0);
    await guardedFetch(`${API}/${id}/descuento`, { method: 'PATCH', body: JSON.stringify({ descuento: val }) });
    onMutate();
  };

  const saveCombo = async (id: number) => {
    const val = Number(edits[`c-${id}`] ?? 0);
    await guardedFetch(`${API_COMBOS}/${id}/descuento`, { method: 'PATCH', body: JSON.stringify({ descuento: val }) });
    onMutate();
  };

  return (
    <section className="dash-section">
      <h2 className="dash-section-title" style={{ marginBottom: 4 }}>Descuentos</h2>
      <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 16px' }}>
        Edita el % de descuento de cada perfume o combo. El precio con descuento se calcula automaticamente.
      </p>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
        Perfumes <span className="dash-count">{perfumes.filter(p => p.descuento > 0).length} con descuento</span>
      </h3>
      <div className="dash-table-wrap" style={{ marginBottom: 24 }}>
        <table className="dash-table">
          <thead><tr><th>Perfume</th><th>Precio</th><th>Descuento %</th><th>Precio final</th><th /></tr></thead>
          <tbody>
            {perfumes.map(p => {
              const key = `p-${p.id}`;
              const val = edits[key] ?? String(p.descuento);
              const final_ = Number(val) > 0 ? Math.round(p.precio * (1 - Number(val) / 100)) : p.precio;
              return (
                <tr key={p.id}>
                  <td className="dash-td-name">{p.nombre}</td>
                  <td className="dash-td-price">{formatPrice(p.precio)}</td>
                  <td style={{ width: 110 }}>
                    <input className="dash-input" type="number" min="0" max="100" value={val}
                      onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: 80 }} />
                  </td>
                  <td className="dash-td-price">{Number(val) > 0 ? formatPrice(final_) : '—'}</td>
                  <td className="dash-td-actions">
                    <button className="dash-btn-accent" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => savePerfume(p.id)}>Guardar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
        Combos <span className="dash-count">{combos.filter(c => c.descuento > 0).length} con descuento</span>
      </h3>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead><tr><th>Combo</th><th>Precio</th><th>Descuento %</th><th>Precio final</th><th /></tr></thead>
          <tbody>
            {combos.map(c => {
              const key = `c-${c.id}`;
              const val = edits[key] ?? String(c.descuento);
              const final_ = Number(val) > 0 ? Math.round(c.precio * (1 - Number(val) / 100)) : c.precio;
              return (
                <tr key={c.id}>
                  <td className="dash-td-name">{c.nombre}</td>
                  <td className="dash-td-price">{formatPrice(c.precio)}</td>
                  <td style={{ width: 110 }}>
                    <input className="dash-input" type="number" min="0" max="100" value={val}
                      onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: 80 }} />
                  </td>
                  <td className="dash-td-price">{Number(val) > 0 ? formatPrice(final_) : '—'}</td>
                  <td className="dash-td-actions">
                    <button className="dash-btn-accent" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => saveCombo(c.id)}>Guardar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
