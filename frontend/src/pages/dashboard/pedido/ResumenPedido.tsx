import { Button } from '@/components/ui/button';
import { formatPrice } from '../helpers';

interface ResumenPedidoProps {
  /** Suma de las líneas, antes de descuentos de pedido. */
  subtotal: number;
  /** Unidades totales, para escribir "Productos (3)". */
  unidades: number;
  /** Ahorro por precio de combo (0 = no aplica). */
  ahorroCombo?: number;
  /** Cupón aplicado, si lo hay. */
  cupon?: { codigo: string; pct: number; descuento: number } | null;
  /** Cómo se llama el total en esta pantalla ("Sugerido", "Deuda del crédito"). */
  etiquetaTotal: string;
  /** Si viene, se pinta el botón que copia el total al campo del valor. */
  onUsar?: () => void;
}

/**
 * Los números del pedido: subtotal, lo que se descuenta y el total.
 *
 * En Ventas el valor se sigue tecleando a mano —es la plata que entró de
 * verdad— así que este bloque PROPONE con el botón "usar", nunca impone.
 */
export function ResumenPedido({
  subtotal, unidades, ahorroCombo = 0, cupon, etiquetaTotal, onUsar,
}: ResumenPedidoProps) {
  const total = Math.max(0, subtotal - ahorroCombo - (cupon?.descuento ?? 0));

  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-3.5 py-3 text-[13px]">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">
          Productos {unidades > 0 && <>({unidades})</>}
        </span>
        <span className="tabular-nums text-foreground">{formatPrice(subtotal)}</span>
      </div>

      {/* Las líneas que valen cero no se pintan: un "Combo −$0" es solo ruido */}
      {ahorroCombo > 0 && (
        <div className="mt-1 flex justify-between gap-3">
          <span className="text-muted-foreground">Precio de combo</span>
          <span className="tabular-nums text-primary">−{formatPrice(ahorroCombo)}</span>
        </div>
      )}

      {cupon && cupon.descuento > 0 && (
        <div className="mt-1 flex justify-between gap-3">
          <span className="text-muted-foreground">
            Cupón {cupon.codigo} {cupon.pct > 0 && <>(−{cupon.pct}%)</>}
          </span>
          <span className="tabular-nums text-primary">−{formatPrice(cupon.descuento)}</span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <span className="font-semibold text-foreground">{etiquetaTotal}</span>
        <span className="flex items-center gap-2.5">
          <span className="font-display text-lg font-medium tabular-nums text-foreground">
            {formatPrice(total)}
          </span>
          {onUsar && (
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={onUsar}>
              usar
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}
