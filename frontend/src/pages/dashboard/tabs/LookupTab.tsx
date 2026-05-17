import { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import type { Lookup } from '../types';

interface LookupTabProps {
  title: string;
  items: Lookup[];
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function LookupTab({ title, items, placeholder, onAdd, onDelete }: LookupTabProps) {
  const [value, setValue] = useState('');

  const handleAdd = async () => {
    if (!value.trim()) return;
    await onAdd(value);
    setValue('');
  };

  return (
    <section className="dash-section">
      <div className="dash-toolbar">
        <h2 className="dash-section-title">{title} <span className="dash-count">{items.length}</span></h2>
      </div>
      <div className="dash-add-row">
        <input
          className="dash-input"
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="dash-btn-accent" onClick={handleAdd}>Agregar</button>
      </div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead><tr><th>#</th><th>Nombre</th><th /></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="dash-td-id">{item.id}</td>
                <td>{item.nombre}</td>
                <td className="dash-td-actions">
                  <button className="dash-icon-btn" onClick={() => onDelete(item.id)} title="Eliminar"><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
