import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  imagenes: string[];
  inicio?: number;
  onClose: () => void;
}

/**
 * Visor con carrusel sobre el `Dialog` de shadcn/Radix. El contenido es compacto
 * (solo imagen + controles); el resto de la pantalla es el Overlay oscuro, así el
 * clic afuera (o Esc) cierra SOLO el visor y deja abierto el modal de opiniones.
 * Flechas, teclado (← →) y miniaturas.
 */
export default function VisorImagenes({ imagenes, inicio = 0, onClose }: Props) {
  const n = imagenes.length;
  const [i, setI] = useState(inicio);
  const ir = useCallback((d: number) => setI((p) => (p + d + n) % n), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') ir(1);
      else if (e.key === 'ArrowLeft') ir(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ir]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogPortal>
        {/* Zona oscura: clic aquí cierra solo esta capa */}
        <DialogOverlay className="z-60 bg-black/85" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Centrado con inset-0 + m-auto (sin translate) para que la X, que es
          // position:fixed, se ancle a la ventana y no a este contenedor.
          className="fixed inset-0 z-60 m-auto flex h-fit w-fit max-h-[92vh] max-w-[96vw] flex-col items-center gap-4 focus:outline-none"
        >
          <DialogTitle className="sr-only">Fotos de la reseña</DialogTitle>

          <DialogClose aria-label="Cerrar"
            className="fixed right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20">
            <X className="size-5" />
          </DialogClose>

          {/* Flechas AFUERA de la imagen, sobre el fondo oscuro (estilo Mercado Libre) */}
          <div className="flex items-center gap-2 sm:gap-4">
            {n > 1 && (
              <button type="button" aria-label="Anterior" onClick={() => ir(-1)}
                className="shrink-0 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20">
                <ChevronLeft className="size-6" />
              </button>
            )}
            <img src={imagenes[i]} alt=""
              className="max-h-[78vh] max-w-[calc(96vw-8rem)] rounded-xl object-contain" />
            {n > 1 && (
              <button type="button" aria-label="Siguiente" onClick={() => ir(1)}
                className="shrink-0 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20">
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>

          {n > 1 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[12px] tabular-nums text-white/80">{i + 1} / {n}</p>
              <div className="flex gap-2">
                {imagenes.map((u, idx) => (
                  <button key={u} type="button" onClick={() => setI(idx)}
                    className={cn('size-12 overflow-hidden rounded-md border-2 transition-all',
                      idx === i ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80')}>
                    <img src={u} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
