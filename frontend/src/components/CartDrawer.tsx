import { useMemo } from 'react';
import { Trash2, Plus, Minus, ShoppingBag, BadgePercent, Gift, Info } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import WhatsAppIcon from './icons/WhatsAppIcon';
import { useCart } from '../application/context/useCart';
import { useCupones, type Cupon } from '../application/hooks/useAnuncios';
import { useComboDetector } from '../application/hooks/useComboDetector';
import type { CartItem } from '../application/context/CartContext';
import { WHATSAPP_NUMBER } from '../config/constants';

interface CuponAplicado {
  cupon: Cupon;
  monto: number;
  /** Unidades de cada item que este cupón descuenta. */
  unidadesPorItem: Map<string, number>;
}

/** El cupón solo toca productos SIN descuento propio y de lo que cubre. */
const cubre = (cupon: Cupon, item: CartItem) =>
  item.descuento === 0 &&
  (item.esCombo ? cupon.aplica_combos : cupon.categorias.includes(item.tipo));

export default function CartDrawer() {
  const { items, totalItems, isOpen, closeCart, removeItem, updateQuantity, clearCart } = useCart();
  const { cupones, emitirCodigo } = useCupones();
  // Combos armados automáticamente con perfumes sueltos (misma categoría y tamaño)
  const deteccion = useComboDetector(items, isOpen && items.length > 0);

  // Reglas del negocio: el precio de combo es mayoreo permanente y SIEMPRE aplica;
  // el cupón (promo de un solo uso por persona) descuenta sobre lo que realmente
  // se paga, combo incluido, con su tope en pesos. Por compra se redime UN solo
  // cupón: el que más descuenta.
  const { aplicados, sinMinimo } = useMemo(() => {
    const candidatos: CuponAplicado[] = [];
    const sinMinimo: { cupon: Cupon; faltanUnidades: number; faltaMonto: number }[] = [];

    for (const cupon of cupones) {
      const cubiertos = items.filter((i) => cubre(cupon, i));
      if (cubiertos.length === 0) continue;

      // Los mínimos se miden sobre el precio de lista (lo que el cliente "compró");
      // el % del cupón se calcula sobre lo que paga de verdad (combo ya rebajado)
      const totalU = cubiertos.reduce((s, i) => s + i.cantidad, 0);
      const bruto = cubiertos.reduce((s, i) => s + i.precio * i.cantidad, 0);
      const ahorroCombos = deteccion.detectados
        .filter((d) => cupon.categorias.includes(d.categoria))
        .reduce((s, d) => s + d.ahorro, 0);
      const base = Math.max(0, bruto - ahorroCombos);

      if (totalU < cupon.min_unidades || bruto < cupon.min_monto) {
        sinMinimo.push({
          cupon,
          faltanUnidades: Math.max(0, cupon.min_unidades - totalU),
          faltaMonto: Math.max(0, cupon.min_monto - bruto),
        });
        continue;
      }

      // Tope de la campaña: el % nunca descuenta más de max_descuento en pesos
      let monto = Math.round((base * cupon.descuento_pct) / 100);
      if (cupon.max_descuento > 0) monto = Math.min(monto, cupon.max_descuento);
      if (monto <= 0) continue;
      candidatos.push({
        cupon,
        monto,
        unidadesPorItem: new Map(cubiertos.map((i) => [i.id, i.cantidad])),
      });
    }

    // Por compra se redime UN solo cupón: el que más descuenta
    candidatos.sort((a, b) => b.monto - a.monto);
    return { aplicados: candidatos.slice(0, 1), sinMinimo };
  }, [items, cupones, deteccion]);

  const subtotal = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  const descuentoCupones = aplicados.reduce((s, a) => s + a.monto, 0);
  const totalPrecio = subtotal - deteccion.ahorroTotal - descuentoCupones;
  const hayDescuentos = deteccion.ahorroTotal > 0 || descuentoCupones > 0;

  const buildWhatsAppMessage = (codigos: Map<number, string | null>) => {
    let msg = 'Hola! Me gustaria hacer el siguiente pedido:\n\n';
    items.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.nombre}\n`;
      msg += `   - Cantidad: ${item.cantidad}\n`;
      if (item.presentacion) msg += `   - Presentacion: ${item.presentacion}\n`;
      msg += `   - Tipo: ${item.tipo}\n`;
      if (item.genero) msg += `   - Genero: ${item.genero}\n`;
      const conCupon = aplicados.find((a) => a.unidadesPorItem.has(item.id));
      if (conCupon) msg += `   - Cupon aplicado: -${conCupon.cupon.descuento_pct}%\n`;
      msg += '\n';
    });
    if (hayDescuentos) {
      msg += `Subtotal: ${formatPrice(subtotal)}\n`;
      for (const d of deteccion.detectados) {
        msg += `Combo detectado "${d.nombre}"${d.veces > 1 ? ` x${d.veces}` : ''} (${d.unidades} perfumes ${d.presentacion}): -${formatPrice(d.ahorro)}\n`;
      }
      for (const a of aplicados) {
        const codigo = codigos.get(a.cupon.id);
        msg += `Cupon "${a.cupon.titulo}" (-${a.cupon.descuento_pct}%)`;
        msg += codigo ? ` — Codigo: ${codigo}` : ' — (codigo pendiente, validar con el admin)';
        msg += `: -${formatPrice(a.monto)}\n`;
      }
      msg += `Total: ${formatPrice(totalPrecio)}\n`;
    }
    return msg.trimEnd();
  };

  const handleOrder = async () => {
    // La pestaña se abre de inmediato (los bloqueadores exigen apertura síncrona)
    const ventana = window.open('', '_blank');
    // Un código único de un solo uso por cada cupón aplicado
    const codigos = new Map<number, string | null>();
    for (const a of aplicados) {
      codigos.set(a.cupon.id, await emitirCodigo(a.cupon));
    }
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(codigos))}`;
    if (ventana) ventana.location.href = url;
    else window.open(url, '_blank');
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/70 px-5 py-4">
          <SheetTitle className="font-display text-xl font-medium text-ink">
            Tu pedido <span className="text-muted-foreground">({totalItems})</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <ShoppingBag className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Tu carrito está vacío</p>
              <p className="text-[13px] text-muted-foreground">
                Agrega perfumes o combos para armar tu pedido
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary">
                    {item.imagen_url ? (
                      <img src={item.imagen_url} alt={item.nombre} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl">
                        {item.esCombo ? '🎁' : '𝒫'}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-foreground">{item.nombre}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {[item.presentacion, item.tipo].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-0.5 text-[13.5px] font-semibold text-primary">
                      {formatPrice(item.precio * item.cantidad)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center rounded-full border border-border">
                      <button
                        className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                        onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                        disabled={item.cantidad <= 1}
                        aria-label="Disminuir cantidad"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-[13px] font-medium">{item.cantidad}</span>
                      <button
                        className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                      aria-label="Quitar del carrito"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 border-t border-border/70 px-5 py-4">
            {/* Empujón de venta: falta poco para armar un combo con mejor precio */}
            {deteccion.sugerencias.map((s) => (
              <p
                key={`${s.categoria}-${s.presentacion}`}
                className="flex items-start gap-1.5 rounded-xl bg-brand-soft px-3 py-2 text-[12px] leading-relaxed text-primary"
              >
                <Gift className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Agrega {s.faltan === 1 ? 'un perfume más' : `${s.faltan} perfumes más`} de{' '}
                  {s.categoria}{s.presentacion ? ` (${s.presentacion})` : ''} y activas el precio
                  especial del combo "{s.nombre}".
                  {/* Sin esta aclaración el cliente cree que ya completó el combo */}
                  {s.excluyePremium && (
                    <span className="mt-0.5 block opacity-80">
                      Los de esencia premium no cuentan para este combo.
                    </span>
                  )}
                </span>
              </p>
            ))}

            {/* Aviso: falta poco para que un cupón aplique */}
            {sinMinimo.map(({ cupon, faltanUnidades, faltaMonto }) => (
              <p key={cupon.id} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Cupón "{cupon.titulo}":{' '}
                  {faltanUnidades > 0
                    ? `te faltan ${faltanUnidades} ${faltanUnidades === 1 ? 'unidad' : 'unidades'}`
                    : `te faltan ${formatPrice(faltaMonto)} en productos que cubre`}{' '}
                  para aplicarlo.
                </span>
              </p>
            ))}

            {hayDescuentos && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-muted-foreground line-through">{formatPrice(subtotal)}</span>
              </div>
            )}

            {deteccion.detectados.map((d) => (
              <div key={`${d.comboId}-${d.presentacion}`} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Gift className="size-3.5" />
                  {d.nombre}
                  {d.veces > 1 && ` x${d.veces}`}
                  <span className="font-normal text-muted-foreground">
                    ({d.unidades} perfumes{d.presentacion ? ` ${d.presentacion}` : ''})
                  </span>
                </span>
                <span className="font-semibold text-primary">-{formatPrice(d.ahorro)}</span>
              </div>
            ))}

            {aplicados.map((a) => (
              <div key={a.cupon.id} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <BadgePercent className="size-3.5" /> {a.cupon.titulo} (-{a.cupon.descuento_pct}%)
                </span>
                <span className="font-semibold text-primary">-{formatPrice(a.monto)}</span>
              </div>
            ))}


            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Total estimado</span>
              <strong className="font-display text-xl font-medium text-ink">{formatPrice(totalPrecio)}</strong>
            </div>
            <Button
              className="h-11 w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleOrder}
            >
              <WhatsAppIcon size={17} />
              Enviar pedido por WhatsApp
            </Button>
            <p className="text-center text-[11.5px] leading-relaxed text-muted-foreground">
              Sin pagos en línea: al enviar el pedido coordinamos contigo el pago y la entrega.
            </p>
            <Button
              variant="ghost"
              className="w-full rounded-full text-muted-foreground hover:text-destructive"
              onClick={clearCart}
            >
              Vaciar carrito
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
