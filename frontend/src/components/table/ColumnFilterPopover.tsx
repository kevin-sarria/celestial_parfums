import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ColumnDef, FilterValue, StringOp, NumberOp, DateOp } from './tableTypes';

interface Props<T> {
  column: ColumnDef<T>;
  active: FilterValue | undefined;
  onApply: (v: FilterValue | null) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export function ColumnFilterPopover<T>({ column, active, onApply, onClose, anchorEl }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const [strOp, setStrOp] = useState<StringOp>((active as { op?: StringOp })?.op ?? 'contains');
  const [strVal, setStrVal] = useState((active as { value?: string })?.value ?? '');

  const [numOp, setNumOp] = useState<NumberOp>((active as { op?: NumberOp })?.op ?? 'eq');
  const [numVal, setNumVal] = useState((active as { value?: string })?.value ?? '');

  const [dateOp, setDateOp] = useState<DateOp>((active as { op?: DateOp })?.op ?? 'eq');
  const [dateVal, setDateVal] = useState((active as { value?: string })?.value ?? '');

  const [enumVals, setEnumVals] = useState<string[]>((active as { values?: string[] })?.values ?? []);

  const updatePos = useCallback(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 6;
    const popoverWidth = 260;
    if (left + popoverWidth > window.innerWidth - 8) {
      left = window.innerWidth - popoverWidth - 8;
    }
    if (left < 8) left = 8;
    setPos({ top, left });
  }, [anchorEl]);

  useEffect(() => {
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [updatePos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorEl && !anchorEl.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorEl]);

  const handleApply = () => {
    const { type } = column;
    if (type === 'string') {
      onApply(strVal.trim() ? { type, op: strOp, value: strVal.trim() } : null);
    } else if (type === 'number' || type === 'currency') {
      onApply(numVal ? { type, op: numOp, value: numVal } : null);
    } else if (type === 'date') {
      onApply(dateVal ? { type, op: dateOp, value: dateVal } : null);
    } else if (type === 'enum') {
      onApply(enumVals.length > 0 ? { type, values: enumVals } : null);
    }
    onClose();
  };

  const toggleEnum = (opt: string, checked: boolean) => {
    setEnumVals(prev => checked ? [...prev, opt] : prev.filter(v => v !== opt));
  };

  if (!pos) return null;

  return createPortal(
    <div ref={ref} className="col-filter-popover" role="dialog" aria-label={`Filtrar ${column.header}`}
      style={{ top: pos.top, left: pos.left }}>
      <div className="col-filter-popover__header">
        <span className="col-filter-title">Filtrar: <strong>{column.header}</strong></span>
        <button type="button" className="col-filter-close" onClick={onClose} aria-label="Cerrar">✕</button>
      </div>

      <div className="col-filter-popover__body">
        {column.type === 'string' && (
          <>
            <select
              className="dash-input"
              value={strOp}
              onChange={e => setStrOp(e.target.value as StringOp)}
            >
              <option value="contains">Contiene</option>
              <option value="equals">Es igual a</option>
              <option value="starts">Empieza con</option>
            </select>
            <input
              className="dash-input"
              placeholder="Escribe la palabra a buscar..."
              value={strVal}
              onChange={e => setStrVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApply()}
              autoFocus
              maxLength={200}
            />
          </>
        )}

        {(column.type === 'number' || column.type === 'currency') && (
          <>
            <select
              className="dash-input"
              value={numOp}
              onChange={e => setNumOp(e.target.value as NumberOp)}
            >
              <option value="eq">Igual a</option>
              <option value="gt">Mayor que</option>
              <option value="lt">Menor que</option>
            </select>
            <input
              className="dash-input"
              type="number"
              placeholder={column.type === 'currency' ? 'Valor en COP...' : 'Valor...'}
              value={numVal}
              onChange={e => setNumVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApply()}
              autoFocus
            />
          </>
        )}

        {column.type === 'date' && (
          <>
            <select
              className="dash-input"
              value={dateOp}
              onChange={e => setDateOp(e.target.value as DateOp)}
            >
              <option value="eq">Igual a</option>
              <option value="before">Antes de</option>
              <option value="after">Después de</option>
            </select>
            <input
              className="dash-input"
              type="date"
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
              autoFocus
            />
          </>
        )}

        {column.type === 'enum' && column.enumOptions && (
          <div className="col-filter-enum">
            {column.enumOptions.map(opt => (
              <label key={opt} className="dash-check">
                <input
                  type="checkbox"
                  checked={enumVals.includes(opt)}
                  onChange={e => toggleEnum(opt, e.target.checked)}
                />
                {opt}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="col-filter-popover__footer">
        <button
          type="button"
          className="dash-btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => { onApply(null); onClose(); }}
        >
          Limpiar
        </button>
        <button
          type="button"
          className="dash-btn-accent"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={handleApply}
        >
          Aplicar
        </button>
      </div>
    </div>,
    document.body,
  );
}
