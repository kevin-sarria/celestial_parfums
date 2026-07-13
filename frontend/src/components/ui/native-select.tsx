import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Select nativo con la apariencia del design system.
 * Mantiene la semántica controlada de un <select> estándar (value/onChange),
 * ideal para formularios existentes sin cambiar su lógica.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative w-full', className)}>
      <select
        data-slot="native-select"
        className="h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-card px-3 pr-8 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
