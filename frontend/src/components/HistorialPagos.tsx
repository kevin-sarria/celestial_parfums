import { Check, CircleDashed, HandCoins, PartyPopper, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { diaEnColombia, fechaLegible, horaEnColombia, leerFecha, mesLegible } from '@/utils/calendario';
import Modal from './Modal';

export interface PagoDelHistorial {
  id?: number;
  monto: number;
  /** Día del abono (fecha de calendario, 'AAAA-MM-DD…'). */
  fecha: string;
  /** Instante en que se anotó: de aquí sale la hora. */
  registrado_en?: string;
}

export interface CreditoDelHistorial {
  /** Día en que se abrió el crédito. */
  fecha: string;
  fecha_limite?: string | null;
  deuda_inicial: number;
  abonos: PagoDelHistorial[];
}

interface Props {
  credito: CreditoDelHistorial;
  /** Solo en el panel: el cliente ve su historial, no lo cambia. */
  onBorrar?: (pago: PagoDelHistorial) => void;
  borrandoId?: number | null;
}

const dia = (s: string) => s.slice(0, 10);

/**
 * "Fecha · hora" de un pago. La hora solo se muestra si el abono se anotó ese
 * mismo día: los que se cargaron después (los de antes del sistema, o uno que
 * se anotó con otra fecha) llevan la hora de cuando se TECLEARON, que no es la
 * hora del pago y confundiría al cliente.
 */
const cuando = (p: PagoDelHistorial) => {
  const conHora = p.registrado_en && diaEnColombia(p.registrado_en) === dia(p.fecha);
  return conHora ? `${fechaLegible(dia(p.fecha))} · ${horaEnColombia(p.registrado_en!)}` : fechaLegible(dia(p.fecha));
};

const nombreDeMes = (s: string) => {
  const f = leerFecha(dia(s));
  return f ? mesLegible(f.anio, f.mes) : '';
};

/** Un punto de la línea de tiempo: el círculo con su icono y, a la derecha, el contenido. */
function Hito({ icono, tono, ultimo, children }: {
  icono: ReactNode; tono: 'pago' | 'meta' | 'pendiente' | 'inicio'; ultimo?: boolean; children: ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* El hilo que une un punto con el siguiente */}
      {!ultimo && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
      <span
        aria-hidden
        className={cn(
          'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border',
          tono === 'pago' && 'border-primary bg-primary text-primary-foreground',
          tono === 'meta' && 'border-emerald-500 bg-emerald-500 text-white',
          tono === 'pendiente' && 'border-dashed border-amber-400 bg-amber-50 text-amber-600',
          tono === 'inicio' && 'border-border bg-secondary text-muted-foreground',
        )}
      >
        {icono}
      </span>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  );
}

/**
 * El historial de pagos de UN crédito, como lo muestran las apps de crédito:
 * un resumen con la barra de avance y, debajo, una línea de tiempo con cada
 * pago agrupado por mes, el día y la hora, y en cuánto quedó la deuda.
 *
 * La línea empieza abajo en "Crédito abierto" y termina arriba en "Deuda
 * saldada" o en lo que falta: el más reciente queda a la vista sin bajar.
 * El número de pago es el de su orden real ("Pago 1" es siempre el primero).
 *
 * Lo usan el panel (con botón para borrar un abono equivocado) y la página
 * "Mi crédito" del cliente: los dos ven exactamente lo mismo.
 */
export function HistorialPagos({ credito, onBorrar, borrandoId = null }: Props) {
  const { abonos, deuda_inicial: deuda } = credito;
  const pagado = abonos.reduce((s, a) => s + a.monto, 0);
  const saldo = Math.max(0, deuda - pagado);
  const avance = deuda > 0 ? Math.min(100, (pagado / deuda) * 100) : 100;
  const ultimo = abonos.at(-1);
  const limite = credito.fecha_limite ? dia(credito.fecha_limite) : null;
  const vencido = saldo > 0 && limite != null && limite < diaEnColombia(new Date().toISOString());

  // Saldo después de cada pago, en su orden real; luego el más reciente arriba
  const filas = abonos.map((p, i) => ({
    p, numero: i + 1,
    saldo: Math.max(0, deuda - abonos.slice(0, i + 1).reduce((s, x) => s + x.monto, 0)),
  })).reverse();

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="rounded-xl border border-border bg-brand-soft/60 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pagado</p>
            <p className="font-display text-2xl font-medium tabular-nums text-primary">{formatPrice(pagado)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {saldo > 0 ? 'Falta' : 'Estado'}
            </p>
            <p className={cn('text-lg font-semibold tabular-nums', saldo > 0 ? 'text-foreground' : 'text-emerald-600')}>
              {saldo > 0 ? formatPrice(saldo) : 'Saldado'}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${avance}%` }} />
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {abonos.length === 0
            ? `Sin pagos todavía · deuda de ${formatPrice(deuda)}`
            : `${abonos.length} ${abonos.length === 1 ? 'pago' : 'pagos'} de ${formatPrice(deuda)} · último el ${fechaLegible(dia(ultimo!.fecha))}`}
        </p>
      </div>

      {/* Línea de tiempo */}
      <ol aria-label="Historial de pagos">
        {saldo > 0 ? (
          <Hito tono="pendiente" icono={<CircleDashed className="size-4" />}>
            <p className="flex justify-between gap-2 text-[13.5px] font-medium text-foreground">
              <span>Falta por pagar</span>
              <span className="tabular-nums">{formatPrice(saldo)}</span>
            </p>
            {limite && (
              <p className={cn('text-[12.5px]', vencido ? 'font-medium text-rose-600' : 'text-muted-foreground')}>
                {vencido ? 'Venció el' : 'Fecha límite:'} {fechaLegible(limite)}
              </p>
            )}
          </Hito>
        ) : (
          <Hito tono="meta" icono={<PartyPopper className="size-4" />}>
            <p className="text-[13.5px] font-medium text-emerald-700">Deuda saldada</p>
            {ultimo && <p className="text-[12.5px] text-muted-foreground">{fechaLegible(dia(ultimo.fecha))}</p>}
          </Hito>
        )}

        {filas.map(({ p, numero, saldo: quedo }, i) => {
          const mes = nombreDeMes(p.fecha);
          const cambiaMes = i === 0 || nombreDeMes(filas[i - 1].p.fecha) !== mes;
          return (
            <Hito key={p.id ?? numero} tono="pago" icono={<Check className="size-4" strokeWidth={3} />}>
              {cambiaMes && (
                <p className="-mt-0.5 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  {mes}
                </p>
              )}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex justify-between gap-2 text-[13.5px]">
                    <span className="font-medium text-foreground">Pago {numero}</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatPrice(p.monto)}</span>
                  </p>
                  <p className="flex flex-wrap justify-between gap-x-2 text-[12.5px] text-muted-foreground">
                    <span>{cuando(p)}</span>
                    <span className="tabular-nums">{quedo > 0 ? `Quedó en ${formatPrice(quedo)}` : 'Saldó la deuda'}</span>
                  </p>
                </div>
                {onBorrar && (
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="-mt-1 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Borrar abono de ${formatPrice(p.monto)}`}
                    disabled={borrandoId !== null}
                    onClick={() => onBorrar(p)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </Hito>
          );
        })}

        <Hito tono="inicio" ultimo icono={<HandCoins className="size-4" />}>
          <p className="flex justify-between gap-2 text-[13.5px] font-medium text-foreground">
            <span>Crédito abierto</span>
            <span className="tabular-nums">{formatPrice(deuda)}</span>
          </p>
          <p className="text-[12.5px] text-muted-foreground">{fechaLegible(dia(credito.fecha))}</p>
        </Hito>
      </ol>
    </div>
  );
}

/** El historial en su propio modal, con un solo botón: cerrar. */
export function HistorialPagosModal({ credito, titulo, onClose, onBorrar, borrandoId }: {
  credito: CreditoDelHistorial | null;
  /** Debajo del título: de quién es o qué se llevó. */
  titulo?: string;
  onClose: () => void;
  onBorrar?: (pago: PagoDelHistorial) => void;
  borrandoId?: number | null;
}) {
  return (
    <Modal open={credito !== null} onClose={onClose} title="Historial de pagos" maxWidth={460}
      ocultarSubmit cancelLabel="Cerrar">
      {titulo && <p className="-mt-1 text-[13px] text-muted-foreground">{titulo}</p>}
      {credito && <HistorialPagos credito={credito} onBorrar={onBorrar} borrandoId={borrandoId} />}
    </Modal>
  );
}
