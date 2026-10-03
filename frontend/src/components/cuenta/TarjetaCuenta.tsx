import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Una puerta de Mi cuenta: qué es, cómo va, y a dónde lleva. La tarjeta
 * entera es el enlace (con el pulgar no hay que apuntarle a un botón chico).
 */
export function TarjetaCuenta({ to, icono: Icono, titulo, children, destacada = false }: {
  to: string;
  icono: LucideIcon;
  titulo: string;
  /** El estado en una o dos líneas: "Llevas 2 de 5 sellos", "3 guardados". */
  children: ReactNode;
  /** La que más importa ahora (un premio listo, un saldo pendiente). */
  destacada?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-start gap-3.5 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/50',
        destacada ? 'border-primary/40 bg-brand-soft/40' : 'border-border',
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
        <Icono className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-[15px] font-medium text-foreground">
          {titulo}
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{children}</span>
      </span>
    </Link>
  );
}
