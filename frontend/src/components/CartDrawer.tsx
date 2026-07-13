import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import WhatsAppIcon from './icons/WhatsAppIcon';
import { useCart } from '../application/context/useCart';
import { WHATSAPP_NUMBER } from '../config/constants';

export default function CartDrawer() {
  const { items, totalItems, isOpen, closeCart, removeItem, updateQuantity, clearCart } = useCart();

  const totalPrecio = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

  const buildWhatsAppMessage = () => {
    let msg = 'Hola! Me gustaria hacer el siguiente pedido:\n\n';
    items.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.nombre}\n`;
      msg += `   - Cantidad: ${item.cantidad}\n`;
      if (item.presentacion) msg += `   - Presentacion: ${item.presentacion}\n`;
      msg += `   - Tipo: ${item.tipo}\n`;
      if (item.genero) msg += `   - Genero: ${item.genero}\n`;
      msg += '\n';
    });
    return msg.trimEnd();
  };

  const handleOrder = () => {
    const msg = buildWhatsAppMessage();
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
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
