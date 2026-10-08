import { Textarea } from '@/components/ui/textarea';
import { formatPrice } from '../helpers';
import { Field } from '../ui';
import { CampoPesos } from '@/components/ui/campo-pesos';

/**
 * EL PRECIO, PARA EL PERSONAL SIN PERMISO DE DESCUENTOS (2026-10-04,
 * decisiones del dueño: el precio no se escribe a mano, y un descuento espera
 * su aprobación).
 *
 * En vez de la casilla de valor libre, se ve el precio que calcula la app y
 * un "Pedir un descuento". Si hay descuento —un precio menor, unidades de
 * regalo o un cupón— hay que escribir por qué, y al guardar el pedido le llega
 * al dueño en vez de registrarse. El servidor vuelve a calcular el precio
 * (`backend/src/middleware/controlPrecio.ts`): esto solo lo hace claro.
 */
export function PrecioPersonal({ etiqueta, normal, conCupon, pidiendo, onPidiendo, pedido, onPedido, motivo, onMotivo, otroDescuento }: {
  etiqueta: string;
  /** Precio normal: tallas, descuento de la página y combos. */
  normal: number;
  /** El precio con el cupón aplicado, si trae uno válido. */
  conCupon: number | null;
  pidiendo: boolean;
  onPidiendo: (v: boolean) => void;
  pedido: string;
  onPedido: (v: string) => void;
  motivo: string;
  onMotivo: (v: string) => void;
  /** Hay regalos o un cupón: ya es un descuento aunque no pida otro precio. */
  otroDescuento: boolean;
}) {
  const hayDescuento = pidiendo || otroDescuento;
  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-foreground/80">{etiqueta}</span>
        <span className="font-display text-lg font-medium tabular-nums text-foreground">
          {formatPrice(pidiendo && Number(pedido) > 0 ? Number(pedido) : conCupon ?? normal)}
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Lo calcula la app con las tallas y los combos{conCupon != null ? ', con el cupón' : ''}. Precio normal: {formatPrice(normal)}.
      </p>

      {!pidiendo ? (
        <button type="button" className="text-[12.5px] font-medium text-primary underline underline-offset-2" onClick={() => onPidiendo(true)}>
          Pedir un descuento
        </button>
      ) : (
        <Field label="¿En cuánto se lo dejas? (COP)">
          <div className="flex items-center gap-2">
            <CampoPesos value={pedido} onChange={e => onPedido(e.target.value)} placeholder={String(normal)} />
            <button type="button" className="shrink-0 text-[12px] text-muted-foreground underline" onClick={() => { onPidiendo(false); onPedido(''); }}>
              Quitar
            </button>
          </div>
        </Field>
      )}

      {hayDescuento && (
        <>
          <Field label="¿Por qué el descuento? *">
            <Textarea rows={2} maxLength={300} value={motivo} onChange={e => onMotivo(e.target.value)}
              placeholder="Ej: cliente frecuente, se lleva 4" />
          </Field>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            Lleva un descuento: al guardar le llega al dueño para aprobarlo, y se registra cuando él decida.
          </p>
        </>
      )}
    </div>
  );
}
