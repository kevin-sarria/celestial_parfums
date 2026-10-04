import { useState } from 'react';
import { Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { etiquetaTalla } from '../../../../domain/entities/linea';
import { formatPrice } from '../../helpers';
import { MetaGanancia } from './MetaGanancia';
import { cumpleMeta, ganancia, metaValida, precioSugerido, textoMeta, type Meta } from './sugerencia';

export interface Desglose { liquido: number; merma: number; frasco: number; empaque: number; total: number }
export interface TallaOriginal {
  presentacion_id: number; nombre: string; ml: number; botella_completa: boolean;
  costo: Desglose | null; precio: number; propio: boolean;
}
export interface Original {
  id: number; nombre: string; publicado: boolean; ml_botella: number | null;
  meta: Meta | null; tallas: TallaOriginal[];
}

export const claveTalla = (perfumeId: number, presentacionId: number) => `${perfumeId}-${presentacionId}`;

/** "Decant 5 ml" / "Botella 100 ml": como la ve el cliente. */
const nombreTalla = (t: TallaOriginal) =>
  etiquetaTalla('original', { presentacion: t.nombre, ml: t.ml, botella_completa: t.botella_completa });

const textoDesglose = (d: Desglose) =>
  [`Líquido ${formatPrice(d.liquido)}`, d.merma && `lo que se pierde al trasvasar ${formatPrice(d.merma)}`,
    d.frasco && `frasco ${formatPrice(d.frasco)}`, d.empaque && `empaque ${formatPrice(d.empaque)}`]
    .filter(Boolean).join(' + ');

/**
 * Un original con sus tallas: lo que cuesta cada una, lo que cobra hoy, lo que
 * deja y lo que se sugiere. Arriba, su meta propia si la tiene (opción B del
 * dueño: un caso puntual que manda sobre la general).
 */
export function OriginalCard({ original, metaGeneral, marcadas, onMarcar, onMeta }: {
  original: Original;
  metaGeneral: Meta;
  marcadas: Set<string>;
  onMarcar: (clave: string) => void;
  onMeta: (meta: Meta | null) => Promise<boolean>;
}) {
  const meta = original.meta ?? metaGeneral;
  const [editando, setEditando] = useState<Meta | null>(null);

  const guardarMeta = async (m: Meta | null) => { if (await onMeta(m)) setEditando(null); };

  return (
    <article className="rounded-xl border border-border bg-card p-4" aria-label={original.nombre}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-medium text-foreground">{original.nombre}</h3>
          {!original.publicado && <p className="text-[12px] text-muted-foreground">Fuera de la tienda</p>}
        </div>
        {original.meta ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-medium text-primary">
            <Target className="size-3.5" /> Meta propia: {textoMeta(original.meta, formatPrice)}
            <button type="button" aria-label="Quitar la meta propia" title="Volver a la meta general"
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10" onClick={() => guardarMeta(null)}>
              <X className="size-3.5" />
            </button>
          </span>
        ) : !editando && (
          <button type="button" className="text-[12.5px] font-medium text-primary underline underline-offset-2"
            onClick={() => setEditando({ ...metaGeneral })}>
            Meta propia para este
          </button>
        )}
      </div>

      {editando && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/40 p-2.5">
          <MetaGanancia etiqueta="Con este quiero ganar" meta={editando} onChange={setEditando} />
          <Button size="sm" disabled={!metaValida(editando)} onClick={() => guardarMeta(editando)}>Guardar</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
        </div>
      )}

      <ul className="mt-2 divide-y divide-border">
        {original.tallas.map(t => {
          const clave = claveTalla(original.id, t.presentacion_id);
          const costo = t.costo?.total ?? null;
          const sugerido = precioSugerido(costo, meta);
          const g = ganancia(t.precio, costo);
          const bajo = !cumpleMeta(t.precio, costo, meta);
          const cambia = sugerido != null && sugerido !== t.precio;
          return (
            <li key={clave} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 py-2 text-[13px] md:grid-cols-[auto_9rem_minmax(8rem,1fr)_minmax(10rem,1.3fr)_minmax(10rem,1.2fr)_minmax(9rem,1fr)]">
              <input type="checkbox" className="size-4 accent-primary" disabled={!cambia}
                aria-label={`Poner el sugerido a ${nombreTalla(t)}`}
                checked={marcadas.has(clave)} onChange={() => onMarcar(clave)} />
              <span className="font-medium text-foreground">{nombreTalla(t)}</span>
              <span className="col-start-2 text-muted-foreground md:col-start-auto" title={t.costo ? textoDesglose(t.costo) : undefined}>
                {costo != null ? <>Te cuesta <span className="tabular-nums text-foreground">{formatPrice(costo)}</span></> : 'Sin costo de compra'}
              </span>
              <span className="col-start-2 md:col-start-auto">
                {t.precio > 0 ? <>Hoy <span className="tabular-nums">{formatPrice(t.precio)}</span></> : <span className="text-amber-700">Sin precio: no sale en la tienda</span>}
              </span>
              <span className={cn('col-start-2 tabular-nums md:col-start-auto', bajo ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {g ? `Ganas ${formatPrice(g.pesos)} (${g.porcentaje} %)` : '—'}
              </span>
              <span className="col-start-2 md:col-start-auto">
                {sugerido != null
                  ? <>
                      Sugerido <strong className={cn('tabular-nums', cambia ? 'text-primary' : 'text-foreground')}>{formatPrice(sugerido)}</strong>
                      {/* Bajar un precio que ya vende es raro: que se vea antes de marcarlo */}
                      {t.precio > 0 && sugerido < t.precio && <span className="ml-1 text-[11.5px] text-amber-700">· baja</span>}
                    </>
                  : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
