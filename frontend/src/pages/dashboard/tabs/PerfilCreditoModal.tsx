import { ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import { formatPrice } from '../helpers';
import { Field } from '../ui';
import type { PerfilCredito } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  perfil: PerfilCredito | null;
  cupoEdit: string;
  onCupoEdit: (v: string) => void;
  onGuardarCupo: () => void;
  guardando: boolean;
}

/**
 * Perfil crediticio interno (SOLO admin): cupo actual y disponible, edición del
 * cupo base y el historial de eventos de comportamiento que ajustan el factor.
 */
export default function PerfilCreditoModal({ open, onClose, perfil, cupoEdit, onCupoEdit, onGuardarCupo, guardando }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={perfil ? `Perfil crediticio · ${perfil.nombre}` : 'Perfil crediticio'}
      maxWidth={520}
      footer={<DialogFooter><Button variant="ghost" onClick={onClose}>Cerrar</Button></DialogFooter>}
    >
      {!perfil && <p className="py-6 text-center text-sm text-muted-foreground">Calculando perfil…</p>}

      {perfil && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {perfil.vetado && (
              <span className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[12px] font-semibold text-rose-600">
                <ShieldAlert className="size-3.5" /> VETADO para credito directo
              </span>
            )}
            <span
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold',
                perfil.tiene_credito_activo
                  ? 'border-amber-200 bg-amber-50 text-amber-600'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-600',
              )}
            >
              {perfil.tiene_credito_activo ? 'Credito activo' : 'Sin deudas'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cupo actual</p>
              <p className="mt-0.5 text-[17px] font-semibold text-foreground">{formatPrice(perfil.cupo)}</p>
              <p className="text-[11.5px] text-muted-foreground">Factor {perfil.factor}x sobre el cupo base</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Disponible</p>
              <p className="mt-0.5 text-[17px] font-semibold text-primary">{formatPrice(perfil.cupo_disponible)}</p>
              <p className="text-[11.5px] text-muted-foreground">Deuda actual: {formatPrice(perfil.deuda_total)}</p>
            </div>
          </div>

          <Field label="Cupo base (COP) — lo defines tu, el factor lo ajusta solo">
            <div className="flex gap-2">
              <Input type="number" min="0" value={cupoEdit} onChange={e => onCupoEdit(e.target.value)} />
              <Button onClick={onGuardarCupo} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
            </div>
          </Field>

          {perfil.eventos.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Comportamiento de pago
              </p>
              <ul className="flex flex-col gap-1.5">
                {perfil.eventos.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    {ev.tipo === 'pago_rapido' && <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />}
                    {ev.tipo === 'pago_lento' && <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-amber-600" />}
                    {ev.tipo === 'cupon_vencido' && <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-rose-600" />}
                    {ev.tipo === 'veto' && <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-rose-600" />}
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">Credito #{ev.credito_id}:</span> {ev.detalle}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Sin eventos de comportamiento todavia (pagos rapidos suben el cupo, moras lo bajan).
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
