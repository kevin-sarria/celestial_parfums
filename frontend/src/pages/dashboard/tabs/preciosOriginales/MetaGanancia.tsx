import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import type { Meta, TipoMeta } from './sugerencia';
import { CampoPesos } from '@/components/ui/campo-pesos';

/**
 * "Quiero ganar [30] [% del precio | $ por unidad]". Lo usan la meta general
 * de la pantalla y la meta propia de un original (2026-10-04).
 */
export function MetaGanancia({ meta, onChange, etiqueta }: {
  meta: Meta;
  onChange: (m: Meta) => void;
  etiqueta: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-foreground">{etiqueta}</span>
      {meta.tipo === 'pesos' ? (
        <CampoPesos
          aria-label={`${etiqueta} (valor)`}
          className="h-9 w-28"
          value={meta.valor || ''}
          onChange={e => onChange({ ...meta, valor: Number(e.target.value) })}
        />
      ) : (
        <Input
          type="number"
          inputMode="numeric"
          aria-label={`${etiqueta} (valor)`}
          className="h-9 w-28"
          min={1}
          max={90}
          value={meta.valor || ''}
          onChange={e => onChange({ ...meta, valor: Number(e.target.value) })}
        />
      )}
      <SelectSimple
        aria-label={`${etiqueta} (en qué)`}
        className="h-9 w-44"
        value={meta.tipo}
        onChange={e => onChange({ tipo: e.target.value as TipoMeta, valor: e.target.value === 'porcentaje' ? 30 : 10000 })}
      >
        <option value="porcentaje">% del precio</option>
        <option value="pesos">pesos por unidad</option>
      </SelectSimple>
    </div>
  );
}
