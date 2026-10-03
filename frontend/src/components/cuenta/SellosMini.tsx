import { cn } from '@/lib/utils';

/**
 * Los sellos de la tarjeta en pequeño: un punto por sello, lleno si ya lo
 * tiene. Lo que en la tarjeta grande se ve en un vistazo, aquí también.
 */
export function SellosMini({ sellos, objetivo, className }: { sellos: number; objetivo: number; className?: string }) {
  return (
    <div className={cn('flex gap-1', className)} aria-label={`${sellos} de ${objetivo} sellos`}>
      {Array.from({ length: objetivo }, (_, i) => (
        <span key={i} className={cn('size-2.5 rounded-full border', i < sellos ? 'border-primary bg-primary' : 'border-primary/40')} />
      ))}
    </div>
  );
}
