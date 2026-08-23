import { createElement } from 'react';
import { ArrowDown, ArrowUp, Link2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRedIcon, getRedLabel } from '../../../../components/contacto/redIcons';
import type { ContactoLink } from '../../../../domain/entities/contacto.schema';

/**
 * Una fila de la lista de links de la página Contáctame.
 *
 * Salió de `RedesTab.tsx` (iba en 665 líneas), donde era un `renderRow` de 47
 * líneas dentro del componente. Aquí recibe por props lo que necesita, así que
 * se puede leer sin tener delante el estado entero de la pestaña.
 */
export function FilaEnlace({ link, esPrimero, esUltimo, onSubir, onBajar, onEditar, onEliminar }: {
  link: ContactoLink;
  esPrimero: boolean;
  esUltimo: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  // Redes muestran su plataforma (salvo texto personalizado); botones su icono elegido.
  // Se pinta con `createElement` y no como `<Icon />` porque el icono sale del
  // catálogo estático de `redIcons`: escrito con mayúscula, el linter lo lee
  // como un componente definido durante el render y avisa (con razón, en
  // general — aquí no se está creando nada, se está eligiendo).
  const icono = link.tipo === 'red'
    ? (link.emoji ? null : getRedIcon(link.nombre))
    : (link.icono ? getRedIcon(link.icono) : null);
  return (

    // flex-wrap + basis del contenido: en pantallas angostas los 4 controles
    // bajan a una segunda línea en lugar de aplastar el nombre a "C…"
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-background px-3.5 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[15px]">
        {icono
          ? createElement(icono, { className: 'size-4 text-primary' })
          : (link.emoji || <Link2 className="size-4 text-primary" />)}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-[13.5px] font-medium text-foreground">
            {link.tipo === 'red' ? getRedLabel(link.nombre) : link.nombre}
          </span>
          {!link.activo && (
            <Badge variant="outline" className="rounded-full text-[10.5px] text-muted-foreground">Inactivo</Badge>
          )}
          {(link.forma || link.color_fondo || link.color_texto) && (
            <Badge variant="secondary" className="rounded-full text-[10.5px] font-medium text-primary">Estilo propio</Badge>
          )}
        </div>
        <span className="block truncate text-[12px] text-muted-foreground">{link.url}</span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Subir"
          disabled={esPrimero} onClick={onSubir}>
          <ArrowUp className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Bajar"
          disabled={esUltimo} onClick={onBajar}>
          <ArrowDown className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" title="Editar"
          onClick={onEditar}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" title="Eliminar"
          onClick={onEliminar}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
