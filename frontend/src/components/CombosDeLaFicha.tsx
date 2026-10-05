import type { Perfume } from '../domain/entities/perfume.schema';
import { etiquetaTalla } from '../domain/entities/linea';
import { tramosDeCombo } from '../application/tramosDeCombo';
import { useCombosActivos } from '../application/hooks/useCombosActivos';
import { formatPrice } from '@/lib/format';

/**
 * "Llévate 2 y ahorras $2.000": el combo ofrecido EN LA FICHA, mientras el
 * cliente decide cuánto llevar.
 *
 * El carrito ya aplicaba el combo, pero solo se enteraba quien abría el carrito
 * —y agregar al carrito no lo abre (lo pidió un cliente real)—. Así que quien
 * compraba de a uno nunca veía que llevando dos pagaba menos.
 *
 * NO menciona el obsequio a propósito: el perfumero ya lo anuncia el renglón
 * "Incluye…" del empaque, y repetirlo haría creer que van dos.
 */
export default function CombosDeLaFicha({ perfume }: { perfume: Perfume }) {
  const combos = useCombosActivos();

  // Una esencia premium nunca entra en un combo: el carrito no le aplicaría el
  // precio, así que ofrecerlo aquí sería prometer algo que no pasa.
  if (perfume.esencia_premium) return null;

  const bloques = perfume.precios
    .map((talla) => ({
      talla,
      tramos: tramosDeCombo(combos, perfume.categoria, talla.presentacion, talla.precio),
    }))
    .filter((b) => b.tramos.length > 0);

  if (bloques.length === 0) return null;
  const variasTallas = bloques.length > 1;

  return (
    <div className="rounded-xl border border-primary/25 bg-brand-soft/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        Llévate más y paga menos
      </p>
      <ul className="mt-1.5 space-y-0.5 text-[13.5px] text-ink">
        {bloques.flatMap(({ talla, tramos }) =>
          tramos.map((t) => (
            <li key={t.comboId}>
              <strong className="font-semibold">{t.cantidad}</strong>{' '}
              {variasTallas ? `en ${etiquetaTalla(perfume.linea, talla)}` : 'perfumes'} por{' '}
              <strong className="font-semibold text-primary">{formatPrice(t.precioCombo)}</strong>{' '}
              <span className="text-muted-foreground">
                (ahorras {formatPrice(t.ahorro)} · {formatPrice(t.precioUnidad)} cada uno)
              </span>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
