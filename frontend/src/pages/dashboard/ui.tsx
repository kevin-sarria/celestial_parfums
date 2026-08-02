import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Primitivas de layout del dashboard.
 * Centralizan el estilo de secciones, toolbars y formularios para que
 * las tabs solo compongan piezas en lugar de repetir clases.
 */

interface SectionProps {
  children: ReactNode;
  className?: string;
}

/** Tarjeta contenedora de cada tab. */
export function Section({ children, className }: SectionProps) {
  return (
    <section
      className={cn(
        'space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgb(0_0_0/0.05)] animate-fade-up md:p-6',
        className,
      )}
    >
      {children}
    </section>
  );
}

interface SectionTitleProps {
  children: ReactNode;
  count?: number | string;
}

/** Título de sección con contador opcional. */
export function SectionTitle({ children, count }: SectionTitleProps) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-lg font-medium text-foreground">
      {children}
      {count !== undefined && (
        <Badge variant="secondary" className="rounded-full px-2.5 font-sans text-[11px] font-semibold">
          {count}
        </Badge>
      )}
    </h2>
  );
}

/** Barra superior de cada sección: título a la izquierda, acciones a la derecha. */
export function Toolbar({ children, className }: SectionProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      {children}
    </div>
  );
}

/** Grupo de acciones (botones de exportar/importar/crear). */
export function ToolbarActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Campo de formulario: etiqueta + control. */
export function Field({ label, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-[12.5px] font-semibold text-foreground/80">{label}</label>
      {children}
    </div>
  );
}

/** Fila de dos campos lado a lado (colapsa en móvil). */
export function FieldRow({ children, className }: SectionProps) {
  return <div className={cn('grid gap-3 sm:grid-cols-2', className)}>{children}</div>;
}

/**
 * Grupo de campos con título. Parte un formulario largo en secciones para que
 * se vea qué pertenece a qué, en vez de una tira de campos todos iguales.
 *
 * Se usa <div> y no <fieldset> a propósito: `Modal` ya envuelve el contenido en
 * un <form>, y el estilo por defecto del fieldset pelea con las clases de Tailwind.
 */
export function BloqueCampos({ titulo, descripcion, children }: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {titulo}
        </p>
        {descripcion && <p className="mt-0.5 text-[12px] text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </div>
  );
}

/** Selector de color: muestra el swatch nativo + el hex editable. */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'}
          onChange={e => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
          aria-label={label as string}
        />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={7}
          className="h-9 w-full max-w-28 rounded-md border border-input bg-card px-3 font-mono text-[13px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
    </Field>
  );
}

/** Mensaje de error de formulario. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-[13px] font-medium text-destructive">{children}</p>;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
}

/** Tarjeta de métrica (totales de ventas, pagos, etc.). */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="min-w-44 rounded-xl border border-border bg-background px-4 py-3">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block font-display text-xl font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Contenedor de tarjetas de métricas. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}
