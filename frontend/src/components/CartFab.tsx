import { useEffect, useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { useCart } from '../application/context/useCart';
import { cerrarRecordatorio, recordatorioPendiente } from '../application/carritoRecordatorio';

export default function CartFab() {
  const { totalItems, openCart, isOpen } = useCart();
  const [recordatorio, setRecordatorio] = useState(false);

  /**
   * Recuperación de carrito: quien VUELVE con productos pendientes recibe un
   * recordatorio suave, una vez por sesión.
   *
   * La marca se vuelve a mirar DENTRO del temporizador, no solo al programarlo:
   * si el cliente agrega algo en esos 2,5 segundos, `addItem` la cierra y el
   * globo ya no sale. Sin eso salía justo después de agregar, diciéndole al
   * cliente algo que acababa de hacer.
   */
  useEffect(() => {
    if (totalItems === 0 || !recordatorioPendiente()) return;
    const mostrar = setTimeout(() => {
      if (!recordatorioPendiente()) return;
      cerrarRecordatorio();
      setRecordatorio(true);
    }, 2500);
    return () => clearTimeout(mostrar);
  }, [totalItems]);

  useEffect(() => {
    if (!recordatorio) return;
    const ocultar = setTimeout(() => setRecordatorio(false), 10000);
    return () => clearTimeout(ocultar);
  }, [recordatorio]);

  useEffect(() => {
    if (isOpen) setRecordatorio(false);
  }, [isOpen]);

  return (
    <>
      {recordatorio && totalItems > 0 && (
        <div className="fixed bottom-22 right-20 z-40 flex max-w-58 animate-fade-up items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)]">
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={() => { setRecordatorio(false); openCart(); }}
          >
            <p className="text-[13px] font-medium text-ink">Tu pedido te espera 🛍</p>
            <p className="text-[12px] text-muted-foreground">
              Tienes {totalItems} {totalItems === 1 ? 'producto' : 'productos'} en el carrito
            </p>
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setRecordatorio(false)}
            aria-label="Cerrar recordatorio"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

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
    </>
  );
}
