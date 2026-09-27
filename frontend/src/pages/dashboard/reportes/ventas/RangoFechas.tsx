import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hoy } from '../../../../utils/fechas';

export interface Rango { desde: string; hasta: string }

/** 'AAAA-MM-DD' del día 1 del mes `delta` meses atrás (0 = este mes). */
const inicioDeMes = (delta: number) => {
  const [a, m] = hoy().split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
};

/** Último día del mes `delta` meses atrás. */
const finDeMes = (delta: number) => {
  const [a, m] = hoy().split('-').map(Number);
  const d = new Date(Date.UTC(a, m - delta, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/**
 * Los atajos de siempre, calculados en el momento: "este mes" el 3 de octubre
 * es octubre, no el mes en que se abrió la pestaña.
 */
const ATAJOS: { etiqueta: string; rango: () => Rango }[] = [
  { etiqueta: 'Este mes', rango: () => ({ desde: inicioDeMes(0), hasta: hoy() }) },
  { etiqueta: 'Mes pasado', rango: () => ({ desde: inicioDeMes(1), hasta: finDeMes(1) }) },
  { etiqueta: 'Últimos 3 meses', rango: () => ({ desde: inicioDeMes(2), hasta: hoy() }) },
  { etiqueta: 'Este año', rango: () => ({ desde: `${hoy().slice(0, 4)}-01-01`, hasta: hoy() }) },
];

export const rangoPorDefecto = ATAJOS[0].rango;

/**
 * Desde / hasta, con atajos. El dueño eligió el rango libre (opción B, el
 * 2026-09-27) sobre un selector de mes: *"me gusta tener la data super
 * detallada"*. Los atajos cubren el 90 % de las consultas sin teclear fechas.
 */
export function RangoFechas({ valor, onCambio }: { valor: Rango; onCambio: (r: Rango) => void }) {
  const activo = ATAJOS.find((a) => {
    const r = a.rango();
    return r.desde === valor.desde && r.hasta === valor.hasta;
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-end gap-2">
        <label className="space-y-1 text-[11.5px] font-semibold text-foreground/70">
          <span className="block">Desde</span>
          <Input type="date" className="h-9 w-38" value={valor.desde} max={valor.hasta}
            onChange={(e) => e.target.value && onCambio({ ...valor, desde: e.target.value })} />
        </label>
        <label className="space-y-1 text-[11.5px] font-semibold text-foreground/70">
          <span className="block">Hasta</span>
          <Input type="date" className="h-9 w-38" value={valor.hasta} min={valor.desde} max={hoy()}
            onChange={(e) => e.target.value && onCambio({ ...valor, hasta: e.target.value })} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de fechas">
        {ATAJOS.map((a) => (
          <button
            key={a.etiqueta}
            type="button"
            aria-pressed={activo === a}
            onClick={() => onCambio(a.rango())}
            className={cn(
              'h-9 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
              activo === a
                ? 'border-primary bg-brand-soft text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
