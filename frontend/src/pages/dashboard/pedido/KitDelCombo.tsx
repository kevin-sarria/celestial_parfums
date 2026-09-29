import { Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Combo } from '../../../domain/entities/combo.schema';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { detectarCombos } from '../../../application/hooks/useComboDetector';
import { agregarKit, kitPendiente } from './kitDelCombo.calculo';
import { itemsDeLineas, type LineaPedido } from './lineasPedido';

/**
 * El aviso "Este combo trae: 1 perfumero, 1 bolsa → Agregar como regalo".
 *
 * Aparece solo cuando el pedido arma un combo con kit y falta algo de ese kit.
 * Un clic lo agrega como regalo; después cada línea se edita como cualquier
 * otra (quitar una, cambiar la cantidad, poner la variante que pidió el
 * cliente). Lo comparten Ventas y Créditos.
 */
export function KitDelCombo({ lineas, onChange, combos, porId }: {
  lineas: LineaPedido[];
  onChange: (lineas: LineaPedido[]) => void;
  combos: Combo[];
  porId: Map<number, Perfume>;
}) {
  const { detectados } = detectarCombos(itemsDeLineas(lineas, porId), combos);
  const pendiente = kitPendiente(detectados, combos, lineas, porId);
  if (pendiente.length === 0) return null;

  const nombres = detectados.map(d => d.nombre).join(' y ');
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2.5 sm:flex-row sm:items-center">
      <p className="flex flex-1 items-start gap-2 text-[12.5px] text-primary">
        <Gift className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>{nombres}</strong> trae: {pendiente.map(k => `${k.cantidad} ${k.nombre}`).join(', ')}.
        </span>
      </p>
      <Button type="button" size="sm" variant="outline" className="shrink-0"
        onClick={() => onChange(agregarKit(lineas, pendiente, porId))}>
        Agregar como regalo
      </Button>
    </div>
  );
}
