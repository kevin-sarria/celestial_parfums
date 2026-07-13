import { ShoppingCart } from 'lucide-react';
import { useCart } from '../application/context/useCart';

export default function CartFab() {
  const { totalItems, openCart } = useCart();

  return (
    <button
      className="fixed bottom-21 right-5 z-40 flex size-13 items-center justify-center rounded-full bg-ink text-background shadow-[0_12px_30px_-10px_rgb(0_0_0/0.4)] transition-transform duration-300 hover:scale-105 active:scale-95"
      onClick={openCart}
      aria-label="Ver carrito"
    >
      <ShoppingCart className="size-5" />
      {totalItems > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {totalItems}
        </span>
      )}
    </button>
  );
}
