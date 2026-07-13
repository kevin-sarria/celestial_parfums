import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardCarouselProps {
  children: ReactNode;
}

/**
 * Carrusel horizontal con scroll-snap nativo (sin dependencias):
 * flechas que aparecen solo cuando hay contenido hacia ese lado,
 * arrastrable/deslizable con el dedo en móvil.
 */
export function CardCarousel({ children }: CardCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const arrowClass =
    'absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-[0_6px_20px_-6px_rgb(0_0_0/0.25)] backdrop-blur transition-all hover:border-primary/40 hover:text-primary';

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateArrows}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {canLeft && (
        <button type="button" className={cn(arrowClass, '-left-2.5')} onClick={() => scroll(-1)} aria-label="Anterior">
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canRight && (
        <button type="button" className={cn(arrowClass, '-right-2.5')} onClick={() => scroll(1)} aria-label="Siguiente">
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}

interface CarouselItemProps {
  children: ReactNode;
  className?: string;
}

/** Slide del carrusel con ancho fijo y snap. */
export function CarouselItem({ children, className }: CarouselItemProps) {
  return <div className={cn('w-64 shrink-0 snap-start sm:w-72', className)}>{children}</div>;
}
