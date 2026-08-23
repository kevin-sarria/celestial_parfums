import { useId, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { CampoEtiquetaContext, type RegistroDeCampo } from '@/components/ui/campoEtiqueta';
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

/**
 * Campo de formulario: etiqueta + control.
 *
 * La etiqueta se enlaza sola con el primer control que se anuncie desde dentro
 * (ver `campoEtiqueta.ts`): así hacer clic en el texto lleva el cursor al campo
 * y un lector de pantalla sabe cómo se llama. Si dentro no hay un control al
 * que enlazarse —un grupo de casillas, el editor de HTML—, no se inventa un
 * `htmlFor` que apunte al vacío.
 */
export function Field({ label, children, className }: FieldProps) {
  const idEtiqueta = useId();
  const [ids, setIds] = useState<string[]>([]);
  const registro = useMemo<RegistroDeCampo>(() => ({
    idEtiqueta,
    registrar: id => setIds(prev => (prev.includes(id) ? prev : [...prev, id])),
    soltar: id => setIds(prev => prev.filter(x => x !== id)),
  }), [idEtiqueta]);

  return (
    <CampoEtiquetaContext.Provider value={registro}>
      <div className={cn('space-y-1.5', className)}>
        <label id={idEtiqueta} htmlFor={ids[0]} className="block text-[12.5px] font-semibold text-foreground/80">
          {label}
        </label>
        {children}
      </div>
    </CampoEtiquetaContext.Provider>
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
  /** Línea de apoyo bajo la cifra (el matiz que no cabe en la etiqueta). */
  nota?: ReactNode;
}

/**
 * Tarjeta de métrica.
 *
 * Va en `bg-card` (blanca) porque vive sobre el fondo marfil de la página. Antes
 * era `bg-background` DENTRO de una tarjeta blanca, o sea al revés: parecía un
 * hueco hundido en vez de un elemento que resalta.
 */
export function StatCard({ label, value, nota }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1.5 block font-display text-2xl font-medium text-foreground">{value}</span>
      {nota && <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{nota}</span>}
    </div>
  );
}

/** Contenedor de métricas de las pestañas que aún no se rediseñan. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}

/**
 * Título y acciones de la pantalla, FUERA de la tarjeta de contenido.
 *
 * Meter el título, los botones, las métricas, el buscador y la tabla dentro de
 * la misma tarjeta deja seis cosas distintas en el mismo plano visual y se lee
 * como un formulario largo, no como un panel.
 */
export function EncabezadoPagina({ titulo, count, children }: {
  titulo: string;
  count?: number | string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2.5 font-display text-xl font-medium text-foreground">
        {titulo}
        {count !== undefined && (
          <Badge variant="secondary" className="rounded-full px-2.5 font-sans text-[11px] font-semibold">
            {count}
          </Badge>
        )}
      </h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * Rejilla de métricas sobre el fondo de la página.
 * Rejilla y no `flex-wrap`: así las tarjetas quedan del mismo ancho, en vez de
 * dejar sobras al final de la fila.
 */
export function FranjaMetricas({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
