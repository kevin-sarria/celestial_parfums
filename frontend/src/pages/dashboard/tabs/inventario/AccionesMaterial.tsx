import { Merge, Pencil, Scale, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InventarioInsumo } from '../../types';

/**
 * Lo que se puede hacer con una fila de material, en escritorio y en móvil.
 *
 * Salió de `InventarioTab.tsx` cuando ese archivo llegó justo a las 500 líneas
 * y había que meterle una acción más: son dos listas de botones que hablan solo
 * de una fila, así que aquí tienen su sitio y allá dejan de estorbar.
 *
 * Se declara a nivel de módulo, nunca dentro del tab: un componente definido
 * dentro de otro es una función nueva en cada render, y React desmontaría y
 * volvería a montar todo el subárbol.
 */

interface Props {
  insumo: InventarioInsumo;
  onAjustar: (i: InventarioInsumo) => void;
  onEditar: (i: InventarioInsumo) => void;
  onFusionar: (i: InventarioInsumo) => void;
  onAlternarActivo: (i: InventarioInsumo) => void;
  onEliminar: (i: InventarioInsumo) => void;
}

const TITULO_FUSIONAR = 'Fusionar: para cuando el mismo material quedó registrado dos veces. '
  + 'Muda su historia al registro bueno sin tocar tus existencias.';

const tituloActivo = (activo: boolean) => (activo
  ? 'Apagar: deja de aparecer al comprar y producir. Su historial queda intacto.'
  : 'Encender: vuelve a estar disponible.');

export function AccionesMaterial({
  insumo: i, onAjustar, onEditar, onFusionar, onAlternarActivo, onEliminar,
}: Props) {
  return (
    <span className="flex items-center justify-end gap-0.5">
      {i.activo && (
        <Button size="sm" variant="ghost" className="h-7" onClick={() => onAjustar(i)}>
          Ajustar
        </Button>
      )}
      <Button size="icon" variant="ghost" className="size-8 text-muted-foreground"
        title="Editar nombre, tipo o unidad"
        onClick={() => onEditar(i)}>
        <Pencil className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="size-8 text-muted-foreground"
        title={TITULO_FUSIONAR}
        onClick={() => onFusionar(i)}>
        <Merge className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="size-8 text-muted-foreground"
        title={tituloActivo(i.activo)}
        onClick={() => onAlternarActivo(i)}>
        {i.activo ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
      </Button>
      <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive"
        title="Eliminar (solo si nunca se usó)"
        onClick={() => onEliminar(i)}>
        <Trash2 className="size-4" />
      </Button>
    </span>
  );
}

export function AccionesMaterialMovil({
  insumo: i, onAjustar, onFusionar, onAlternarActivo, onEliminar,
}: Omit<Props, 'onEditar'>) {
  return (
    <>
      {i.activo && (
        <Button size="sm" variant="outline" onClick={() => onAjustar(i)}>
          <Scale className="size-4" /> Ajustar existencias
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => onFusionar(i)}>
        <Merge className="size-4" /> Fusionar
      </Button>
      <Button size="sm" variant="outline" onClick={() => onAlternarActivo(i)}>
        {i.activo ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
        {i.activo ? 'Apagar' : 'Encender'}
      </Button>
      <Button size="sm" variant="outline" className="text-destructive"
        onClick={() => onEliminar(i)}>
        <Trash2 className="size-4" /> Eliminar
      </Button>
    </>
  );
}
