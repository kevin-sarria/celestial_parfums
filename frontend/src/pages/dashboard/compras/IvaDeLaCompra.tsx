import { SelectSimple } from '@/components/ui/select-simple';
import { formatPrice } from '../helpers';
import { Field } from '../ui';
import type { IvaModo } from '../types';
import { IVA_MODOS, desglosarIva } from './iva';

interface Props {
  /** El valor tal como viene en la factura. */
  valor: number;
  modo: IvaModo;
  tasa: number;
  /** Modo que trae el proveedor, para poder decir cuándo se está corrigiendo. */
  modoDelProveedor: IvaModo;
  onModo: (m: IvaModo) => void;
}

/**
 * El IVA de una compra, con la cuenta hecha a la vista.
 *
 * Ver el total ANTES de guardar es lo que impide el error: pedirle al dueño que
 * multiplique de cabeza garantiza que algún día se equivoque, y como el costo
 * promedio se arrastra, ese error no se deshace después.
 */
export function IvaDeLaCompra({ valor, modo, tasa, modoDelProveedor, onModo }: Props) {
  const d = desglosarIva(valor || 0, modo, tasa);
  const corregido = modo !== modoDelProveedor;
  const pct = Math.round(tasa * 1000) / 10;

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
      <Field label="¿Cómo te factura el IVA este proveedor?">
        <SelectSimple value={modo} onChange={e => onModo(e.target.value as IvaModo)}>
          {IVA_MODOS.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
        </SelectSimple>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {IVA_MODOS.find(m => m.valor === modo)?.ayuda}
          {corregido && (
            <span className="ml-1 font-medium text-amber-700">
              Solo para esta factura; no cambia la configuración del proveedor.
            </span>
          )}
        </p>
      </Field>

      {valor > 0 && (
        <dl className="space-y-1 border-t border-border pt-2 text-[12.5px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Valor de la factura</dt>
            <dd className="tabular-nums text-foreground">{formatPrice(valor)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              IVA ({pct}%){modo === 'incluido' && <> · ya incluido</>}
            </dt>
            <dd className="tabular-nums text-muted-foreground">{formatPrice(Math.round(d.iva))}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-border pt-1">
            <dt className="font-semibold text-foreground">Costo real del material</dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatPrice(Math.round(d.total))}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
