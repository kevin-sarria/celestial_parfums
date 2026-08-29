import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import { cn } from '@/lib/utils';
import type { Alerta, AlertaDisparada, Ambito } from './ambitos';

/**
 * UNA FAMILIA DE MATERIAL, en un renglón.
 *
 * Es un componente aparte y NO una función dentro de la pantalla: declarar un
 * componente dentro de otro lo vuelve a montar en cada render y se lleva por
 * delante lo que se estaba tecleando (regla del proyecto, y aquí se teclea).
 *
 * No sabe guardar ni consultar: recibe lo que hay y avisa de cada cambio. La
 * pantalla decide cuándo eso viaja al servidor — que es justo lo que pidió el
 * dueño el 2026-08-29: *"debería ser más como un formulario clásico con el
 * apartado de guardar"*.
 */

interface Props {
  fila: { ambito: Ambito; titulo: string; unidad: string; explicacion: string };
  valor: Alerta;
  disparada?: AlertaDisparada;
  /** true = tiene cambios sin guardar; se marca para que no se pierdan de vista. */
  tocada: boolean;
  onCambio: (cambios: Partial<Alerta>) => void;
}

export function FilaAlerta({ fila, valor, disparada, tocada, onCambio }: Props) {
  const apagada = !valor.activo;

  return (
    <div className={cn(
      'grid gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1.9fr)_132px_170px_minmax(0,1.2fr)_auto] sm:items-center',
      apagada && 'opacity-60',
    )}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">
          {fila.titulo}
          {tocada && (
            <span className="ml-1.5 rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800">
              sin guardar
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{fila.explicacion}</p>
      </div>

      {/* El nombre accesible va en `aria-label` y no en un <label> visible: la
          etiqueta de la columna ya está en el encabezado de la rejilla, y
          repetirla en cada fila es justo el aire que el dueño pidió quitar. */}
      <div className="flex items-center gap-1.5">
        <Input
          type="number" min="0" className="h-8 text-[13px]"
          value={valor.minimo || ''}
          placeholder="0"
          aria-label={`Avísame cuando queden menos de (${fila.unidad}) — ${fila.titulo}`}
          onChange={(e) => onCambio({ minimo: Number(e.target.value) || 0 })}
        />
        <span className="shrink-0 text-[11.5px] text-muted-foreground">{fila.unidad}</span>
      </div>

      <SelectSimple
        className="h-8 text-[12.5px]"
        value={valor.forma}
        aria-label={`Cómo avisar — ${fila.titulo}`}
        onChange={(e) => onCambio({ forma: e.target.value as Alerta['forma'] })}
      >
        <option value="franja">Franja discreta</option>
        <option value="ventana">Ventana en medio</option>
      </SelectSimple>

      <Input
        className="h-8 text-[12.5px]"
        maxLength={150}
        value={valor.titulo ?? ''}
        aria-label={`Texto propio del aviso — ${fila.titulo}`}
        placeholder={`${fila.titulo} por debajo del mínimo`}
        onChange={(e) => onCambio({ titulo: e.target.value })}
      />

      {/* Encendida/apagada es un cambio más del formulario: no se guarda solo. */}
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground sm:justify-self-end">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-primary)]"
          checked={valor.activo}
          aria-label={`Alerta encendida — ${fila.titulo}`}
          onChange={(e) => onCambio({ activo: e.target.checked })}
        />
        Encendida
      </label>

      {/* Lo que la regla marca AHORA: poner un número sin ver a cuántos
          materiales alcanza es adivinar. Cabe en un renglón a propósito. */}
      <p className={cn(
        'min-w-0 truncate text-[11.5px] sm:col-span-5',
        disparada ? 'text-amber-700' : 'text-muted-foreground',
      )}>
        {disparada ? (
          <>
            <AlertTriangle className="mr-1 inline size-3" />
            Ahora marca <strong>{disparada.materiales.length}</strong>:{' '}
            {disparada.materiales.slice(0, 4).map((m) => m.nombre).join(', ')}
            {disparada.materiales.length > 4 && ` y ${disparada.materiales.length - 4} más`}.
          </>
        ) : 'Ahora mismo no marca nada.'}
      </p>
    </div>
  );
}
