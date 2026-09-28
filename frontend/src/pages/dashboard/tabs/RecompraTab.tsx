import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ReporteShell, useReporte } from '../reportes/comun';
import { FranjaMetricas, StatCard } from '../ui';
import { ETIQUETA, TarjetaCliente } from './recompra/TarjetaCliente';
import type { EstadoRecompra, ListaRecompra } from './recompra/tipos';

/**
 * RECOMPRA: a qué clientes ya se les debería estar acabando el perfume, para
 * escribirles por WhatsApp (2026-09-28). Es la venta más barata de la tienda:
 * 60 de 150 clientes ya repiten.
 *
 * El ritmo sale de las fechas de compra de CADA cliente (decisión del dueño:
 * a unos les dura una semana y a otros tres meses). Quien compró una sola vez
 * usa el punto medio de los que repiten. El cálculo vive en el servidor
 * (`recompra.calculo.ts`).
 */

type Filtro = EstadoRecompra | 'todos';
const FILTROS: Filtro[] = ['le_toca', 'pronto', 'dormido', 'al_dia', 'todos'];

/** Tope de tarjetas pintadas a la vez: "Dormidos" puede pasar de cien. */
const TOPE = 40;

export function RecompraTab() {
  const { datos, cargando, error, recargar } = useReporte<ListaRecompra>('recompra');
  const [filtro, setFiltro] = useState<Filtro>('le_toca');
  const [tope, setTope] = useState(TOPE);

  const lista = datos ? datos.clientes.filter((c) => filtro === 'todos' || c.estado === filtro) : [];
  const cuantos = (f: Filtro) => (datos ? (f === 'todos' ? datos.clientes.length : datos.resumen[f]) : 0);

  return (
    <ReporteShell titulo="Recompra" cargando={cargando && !datos} error={error} onReintentar={recargar}>
      {datos && (
        <div className="space-y-4">
          <FranjaMetricas>
            <StatCard label="Le toca ahora" value={String(datos.resumen.le_toca)}
              nota="Ya pasó su fecha: se le debe estar acabando" />
            <StatCard label="Pronto" value={String(datos.resumen.pronto)} nota="Le toca en los próximos 7 días" />
            <StatCard label="Compra típica" value={`Cada ${datos.punto_medio_dias} días`}
              nota={`El punto medio de ${datos.clientes_que_repiten} clientes que repiten`} />
          </FranjaMetricas>

          <div role="tablist" aria-label="Qué clientes ver" className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f} role="tab" aria-selected={filtro === f}
                onClick={() => { setFiltro(f); setTope(TOPE); }}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                  filtro === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-secondary',
                )}
              >
                {f === 'todos' ? 'Todos' : f === 'dormido' ? 'Dormidos' : ETIQUETA[f]} ({cuantos(f)})
              </button>
            ))}
          </div>

          {filtro === 'dormido' && (
            <p className="text-[12.5px] text-muted-foreground">
              Pasó más de un ciclo entero de su fecha sin volver: no es que se le acabó, es que dejó de comprar.
              El mensaje sugerido lo invita a volver.
            </p>
          )}

          {lista.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-[13.5px] text-muted-foreground">
              No hay clientes en este grupo.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.slice(0, tope).map((c) => <TarjetaCliente key={c.clave} c={c} />)}
            </ul>
          )}
          {lista.length > tope && (
            <button onClick={() => setTope((t) => t + TOPE)} className="w-full rounded-xl border border-dashed border-border py-2.5 text-[13px] font-medium text-primary hover:bg-secondary">
              Ver {Math.min(TOPE, lista.length - tope)} más (quedan {lista.length - tope})
            </button>
          )}
        </div>
      )}
    </ReporteShell>
  );
}
