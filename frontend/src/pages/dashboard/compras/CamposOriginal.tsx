import { Input } from '@/components/ui/input';
import { Field, FieldRow } from '../ui';
import BuscadorSelect from '../../../components/BuscadorSelect';
import type { Perfume } from '../../../domain/entities/perfume.schema';

/**
 * Lo que solo pregunta una BOTELLA ORIGINAL al darla de alta en la compra:
 * cuántos ml trae y si ya vendías esa fragancia en contratipo.
 *
 * Lo segundo existe porque el dueño lo pidió así (2026-09-29): si ya tiene la
 * ficha del contratipo —foto, notas, descripción— no tiene por qué volver a
 * escribirla para el original. Se propone sola cuando el nombre coincide; él
 * puede cambiarla o decir que no.
 */
export function CamposOriginal({ mlBotella, onMlBotella, fragancias, copiarDe, onCopiarDe, nombres }: {
  mlBotella: string;
  onMlBotella: (v: string) => void;
  /** De dónde se puede copiar la ficha. null = cargando. */
  fragancias: Perfume[] | null;
  /** La elegida: un id, o '' para no copiar nada. */
  copiarDe: number | '';
  onCopiarDe: (id: number | '') => void;
  /** Cómo quedarán el material y la ficha, para mostrárselo antes de crear. */
  nombres: { insumo: string; producto: string };
}) {
  const ml = Number(mlBotella);
  return (
    <>
      <FieldRow>
        <Field label="¿Cuántos ml trae la botella? *" className="w-52">
          <Input type="number" min="1" max="2000" inputMode="numeric" value={mlBotella}
            placeholder="Ej: 100" onChange={(e) => onMlBotella(e.target.value)} />
        </Field>
        <Field label="Copiar la ficha del contratipo" className="min-w-52 flex-1">
          <BuscadorSelect
            opciones={[
              { id: '', nombre: 'No, empezar la ficha en blanco' },
              ...(fragancias ?? []).map((p) => ({ id: p.id as number | string, nombre: p.nombre, nota: p.categoria ?? undefined })),
            ]}
            value={copiarDe}
            placeholder={fragancias ? 'Elegir perfume…' : 'Cargando catálogo…'}
            onSelect={(id) => onCopiarDe(id === '' ? '' : Number(id))}
          />
        </Field>
      </FieldRow>

      <div className="mt-2.5 rounded-lg border border-border bg-secondary/50 p-2.5 text-[12.5px] leading-snug text-muted-foreground">
        {nombres.producto && ml > 0 ? (
          <>
            Se guardarán dos cosas:{' '}
            <strong className="font-medium text-foreground">{nombres.insumo}</strong> como material
            (su stock va en ml, y en esta compra la anotas en <strong className="font-medium text-foreground">botellas</strong>),
            y la ficha <strong className="font-medium text-foreground">{nombres.producto}</strong> con
            decants de 3, 5 y 10 ml y la botella completa de {ml} ml
            {copiarDe !== '' && ', con la foto, notas y descripción del contratipo'}.
            Queda <strong className="font-medium text-primary">fuera de la tienda y sin precios</strong>:
            ponlos en Productos y publícala cuando esté lista.
          </>
        ) : (
          'Escribe el nombre del perfume y los ml de la botella, y te digo cómo va a quedar.'
        )}
      </div>
    </>
  );
}
