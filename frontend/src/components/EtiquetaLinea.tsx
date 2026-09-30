import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { NOMBRE_LINEA, type Linea } from '../domain/entities/linea';

/**
 * La etiqueta de la línea: Original, 1.1 o Contratipo, cada una con su peso.
 *
 * El original va en tinta sólida —es la compra grande—, el 1.1 en iris y el
 * contratipo en lila suave. El contratipo de esencia premium conserva su
 * distintivo propio, que dice más que "Contratipo" a secas. Lo que no es una
 * fragancia (un accesorio, un splash) muestra su categoría, si la tiene.
 */
const ESTILO: Partial<Record<Linea, string>> = {
  original: 'border-none bg-ink text-background',
  '1.1': 'border-none bg-primary text-primary-foreground',
  contratipo: 'border-none bg-accent text-accent-foreground',
};

export default function EtiquetaLinea({ linea, esenciaPremium, categoria, className }: {
  linea: Linea;
  esenciaPremium?: boolean;
  categoria?: string | null;
  className?: string;
}) {
  const base = 'shrink-0 rounded-full px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em]';
  if (linea === 'contratipo' && esenciaPremium) {
    return (
      <Badge variant="outline" className={cn(base, 'border-ink text-ink', className)}
        title="Elaborado con la esencia de mayor calidad del laboratorio">
        Esencia premium
      </Badge>
    );
  }
  const nombre = NOMBRE_LINEA[linea];
  if (!nombre) {
    return categoria ? (
      <Badge variant="outline" className={cn('max-w-24 shrink-0 rounded-full text-[10.5px] font-medium text-muted-foreground', className)}>
        <span className="truncate">{categoria}</span>
      </Badge>
    ) : null;
  }
  return <Badge className={cn(base, ESTILO[linea], className)}>{nombre}</Badge>;
}
