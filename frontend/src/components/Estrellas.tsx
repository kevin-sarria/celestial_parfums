import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Valor 0-5 (admite medias). */
  valor: number;
  /** Cantidad de reseñas (opcional, se muestra al lado). */
  total?: number;
  /** Tamaño de las estrellas en px. */
  size?: number;
  className?: string;
}

/**
 * Estrellas de calificación (solo lectura). Rellena estrellas completas y una
 * media según el valor. Dorado cálido, discreto.
 */
export default function Estrellas({ valor, total, size = 14, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="inline-flex" aria-label={`${valor} de 5 estrellas`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const llenado = Math.max(0, Math.min(1, valor - i)); // 0..1 por estrella
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star className="absolute inset-0" style={{ width: size, height: size, color: '#d9b45a' }} strokeWidth={1.5} />
              {llenado > 0 && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${llenado * 100}%` }}>
                  <Star style={{ width: size, height: size, color: '#d9b45a', fill: '#d9b45a' }} strokeWidth={1.5} />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {total !== undefined && total > 0 && (
        <span className="text-[12px] text-muted-foreground">{valor.toFixed(1)} ({total})</span>
      )}
    </span>
  );
}
