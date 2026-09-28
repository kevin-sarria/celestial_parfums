import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * El campo del cupón cuando ya se canjeó: bloqueado, con el porqué.
 *
 * Lo usan Ventas y Créditos, que desde el 2026-09-28 siguen la MISMA regla
 * (decisión del dueño): un cupón canjeado queda amarrado y solo se suelta
 * eliminando la venta o el crédito. El servidor la hace cumplir igual
 * (`exigirCuponIntacto`); esto solo evita que se intente.
 */
export function CuponAmarrado({ codigo, de }: { codigo: string; de: 'venta' | 'crédito' }) {
  const [este, el, lo] = de === 'venta' ? ['esta venta', 'la venta', 'registrarla'] : ['este crédito', 'el crédito', 'registrarlo'];
  return (
    <>
      <div className="relative">
        <Input value={codigo} disabled className="pr-9 uppercase" />
        <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <p className="mt-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-[12.5px] text-muted-foreground">
        Este cupón <strong>ya se canjeó</strong> y queda amarrado a {este}. Para cambiarlo hay que
        eliminar {el} y volver a {lo} — así nadie lo revive por accidente.
      </p>
    </>
  );
}
