import { cn } from '@/lib/utils';

/** Ruta pública del logo de la marca (frasco en tinta, el mismo color del texto). */
export const BRAND_ICON_SRC = '/icons/icon-celestial-parfums-ink.png';

interface Props {
  className?: string;
  /** Cuando el logo va junto al texto "Celestial Parfums" es decorativo. */
  decorative?: boolean;
}

/**
 * Logo de Celestial Parfums.
 * Reemplaza el antiguo glifo ✦ en el header, dashboard, auth y footer.
 * El icono tiene halo y espacio transparente propios, por eso se usa object-contain.
 */
export function BrandMark({ className, decorative = true }: Props) {
  return (
    <img
      src={BRAND_ICON_SRC}
      alt={decorative ? '' : 'Celestial Parfums'}
      aria-hidden={decorative || undefined}
      className={cn('inline-block shrink-0 object-contain', className)}
    />
  );
}
