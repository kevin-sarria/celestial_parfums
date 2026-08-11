import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/format';

interface Agregado {
  nombre: string;
  presentacion: string;
  cantidad: number;
  precio: number;
  imagen_url: string | null;
}

/**
 * Confirma que el producto entró al carrito, sin abrirlo.
 *
 * Antes el carrito se desplegaba en cada "agregar". Un cliente lo señaló: abrir
 * y cerrar el panel en cada producto cansa y corta el impulso de seguir
 * comprando. Lo que hacía falta no era el carrito entero, sino la certeza de
 * que la acción funcionó — y para eso basta la foto y el nombre.
 *
 * Se deduplica con un id fijo: agregar tres cosas seguidas deja UN aviso que se
 * reemplaza, no tres apilados tapando la pantalla.
 *
 * Sale ABAJO AL CENTRO, no en la esquina como el resto de avisos: en la tienda
 * esa esquina la ocupan los botones flotantes de carrito y WhatsApp, y el aviso
 * les caía encima justo cuando el cliente quiere ver que el contador subió.
 */
export const avisarAgregado = (item: Agregado) => {
  // SIN caja propia: la tarjeta (fondo, borde, redondeo y sombra) la pone el
  // contenedor de sonner, igual que en el resto de avisos. Cuando este
  // componente traía su propio recuadro quedaba UNA CAJA DENTRO DE OTRA — lo
  // cazó el dueño en una captura. Aquí solo va el contenido.
  toast.custom(
    () => (
      <div className="flex w-full items-center gap-3">
        {item.imagen_url ? (
          <img
            src={item.imagen_url}
            alt=""
            className="size-11 shrink-0 rounded-lg border border-border object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
            <Check className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
            <Check className="size-3.5" /> Agregado al carrito
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-medium text-foreground">
            {item.cantidad > 1 && `${item.cantidad}× `}{item.nombre}
          </span>
          <span className="block text-[11.5px] text-muted-foreground">
            {item.presentacion} · {formatPrice(item.precio * item.cantidad)}
          </span>
        </span>
      </div>
    ),
    { id: 'carrito-agregado', duration: 2600, position: 'bottom-center' },
  );
};
