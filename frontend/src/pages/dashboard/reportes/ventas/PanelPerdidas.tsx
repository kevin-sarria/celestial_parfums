import { formatPrice, fmtDate } from '../../helpers';
import { Panel } from '../comun';
import type { Perdidas } from './tipos';

/**
 * Lo que se perdió en el rango, causa por causa.
 *
 * Cada renglón dice DE DÓNDE sale, para que un número no asuste sin
 * explicación. Las muestras van al final y FUERA del total: son inversión en
 * vender, no pérdida (decisión del 2026-08-10).
 */
export function PanelPerdidas({ p }: { p: Perdidas }) {
  const renglones: { nombre: string; valor: number; ayuda: string }[] = [
    { nombre: 'Mermas', valor: p.mermas, ayuda: 'Derrames, frascos rotos, esencia dañada' },
    { nombre: 'Diferencias al contar', valor: p.diferencias_conteo, ayuda: 'Lo que faltó al hacer un conteo físico' },
    { nombre: 'Garantías repuestas', valor: p.garantias, ayuda: 'Costo del frasco que se repuso' },
    { nombre: 'Dinero devuelto', valor: p.dinero_devuelto, ayuda: 'Devoluciones resueltas con plata' },
    { nombre: 'Ventas por debajo del costo', valor: p.ventas_bajo_costo, ayuda: 'Lo que costó de más contra lo que se cobró' },
  ];

  return (
    <Panel className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-medium">Pérdidas</h3>
        <span className={`font-display text-xl ${p.total > 0 ? 'text-destructive' : 'text-foreground'}`}>
          {formatPrice(p.total)}
        </span>
      </div>
      <ul className="divide-y divide-border text-[13px]">
        {renglones.map((r) => (
          <li key={r.nombre} className="flex items-baseline justify-between gap-3 py-2">
            <span>
              <span className="font-medium">{r.nombre}</span>
              <span className="block text-[12px] text-muted-foreground">{r.ayuda}</span>
            </span>
            <span className={`tabular-nums ${r.valor > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
              {formatPrice(r.valor)}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 py-2">
          <span>
            <span className="font-medium">Muestras y mostrario</span>
            <span className="block text-[12px] text-muted-foreground">No es pérdida: es inversión en vender. No suma al total.</span>
          </span>
          <span className="tabular-nums text-muted-foreground">{formatPrice(p.muestras)}</span>
        </li>
      </ul>

      {p.detalle_bajo_costo.length > 0 && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer font-medium text-primary">
            Ver las {p.detalle_bajo_costo.length} ventas por debajo del costo
          </summary>
          <ul className="mt-2 space-y-1">
            {p.detalle_bajo_costo.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 tabular-nums">
                <span>{fmtDate(v.dia)} · {v.persona}</span>
                <span>cobrado {formatPrice(v.valor)} · costó {formatPrice(v.costo)} · <strong className="text-destructive">−{formatPrice(v.perdida)}</strong></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
