import { useState, useEffect } from 'react';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatPrice, finalPrice } from '@/lib/format';
import { Chip } from './catalog/FilterChips';
import { useCart } from '../application/context/useCart';

interface Props {
  open: boolean;
  onClose: () => void;
  producto: {
    id: number;
    nombre: string;
    precio: number;
    /** Precio de cada presentación; sin él se usa `precio` para todas. */
    precios?: { presentacion: string; precio: number }[];
    /** Descuento propio del producto (%): con él, los cupones no se acumulan. */
    descuento: number;
    imagen_url: string | null;
    esCombo: boolean;
    categoria: string | null;
    genero: string | null;
    presentaciones: string[];
    /** Contratipo esencia premium: nunca entra en el precio de combo. */
    esenciaPremium?: boolean;
  };
}

export default function AddToCartModal({ open, onClose, producto }: Props) {
  const { addItem } = useCart();
  const [cantidad, setCantidad] = useState(1);
  const [presentacion, setPresentacion] = useState('');

  const tipo = producto.categoria ?? '';
  const presentaciones = producto.presentaciones ?? [];

  // Cada presentación tiene su precio; si falta, se usa el de portada.
  const precioDe = (p: string) =>
    producto.precios?.find((x) => x.presentacion === p)?.precio ?? producto.precio;
  const precioActual = presentacion ? precioDe(presentacion) : producto.precio;

  useEffect(() => {
    if (open) {
      setCantidad(1);
      setPresentacion(presentaciones[0] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAdd = () => {
    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      tipo,
      presentacion,
      genero: producto.genero,
      cantidad,
      // El precio del carrito es el de LA presentación elegida
      precio: finalPrice(precioActual, producto.descuento),
      descuento: producto.descuento,
      imagen_url: producto.imagen_url,
      esCombo: producto.esCombo,
      esenciaPremium: producto.esenciaPremium ?? false,
    });
    setCantidad(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-medium text-ink">
            Agregar al carrito
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          {producto.imagen_url && (
            <img
              src={producto.imagen_url}
              alt={producto.nombre}
              className="size-16 rounded-xl border border-border object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-medium text-foreground">{producto.nombre}</p>
            {tipo && <p className="text-[12.5px] text-muted-foreground">{tipo}</p>}
          </div>
        </div>

        {presentaciones.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Presentación
            </p>
            {/* Cada talla lleva su precio: el cliente ve qué cuesta antes de elegir */}
            <div className="flex flex-wrap gap-1.5">
              {presentaciones.map((p) => (
                <Chip key={p} active={presentacion === p} onClick={() => setPresentacion(p)}>
                  {p} · {formatPrice(finalPrice(precioDe(p), producto.descuento))}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Cantidad
          </p>
          <div className="flex w-fit items-center rounded-full border border-border">
            <button
              type="button"
              className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              onClick={() => setCantidad((q) => Math.max(1, q - 1))}
              disabled={cantidad <= 1}
              aria-label="Disminuir cantidad"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-[14px] font-medium">{cantidad}</span>
            <button
              type="button"
              className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setCantidad((q) => q + 1)}
              aria-label="Aumentar cantidad"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex items-baseline justify-between rounded-xl bg-secondary/50 px-3.5 py-2.5">
          <span className="text-[12.5px] text-muted-foreground">Total</span>
          <span className="font-display text-lg font-medium text-ink">
            {formatPrice(finalPrice(precioActual, producto.descuento) * cantidad)}
          </span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-full" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={handleAdd}>
            <ShoppingCart className="size-4" />
            Agregar al carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
