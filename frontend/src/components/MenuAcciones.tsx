import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface AccionMenu {
  label: string;
  /** La aclaración que no cabe en el nombre. Es lo que evita tener que explicar el botón. */
  nota?: string;
  icon?: LucideIcon;
  onSelect: () => void;
}

interface Props {
  /** Nombre del grupo, en el idioma del negocio: "Registrar uso", no "Movimientos". */
  label: string;
  icon?: LucideIcon;
  /** Encabezado dentro del panel. Si no viene, se usa el label. */
  titulo?: string;
  acciones: AccionMenu[];
}

/**
 * Varias acciones emparentadas agrupadas en un solo botón desplegable.
 *
 * Nació de la barra de Inventario, que había llegado a seis botones del mismo
 * peso: cada función nueva agregó el suyo y encontrar la acción que se hace a
 * diario costaba lo mismo que encontrar la de una vez al mes. La regla que se
 * aplicó es la del catálogo de defectos: **una acción principal destacada, las
 * de todos los días visibles, y lo demás agrupado por la pregunta que responde**.
 *
 * Hermano de `ExportMenu`, que hace lo mismo para las descargas de Excel. Este
 * es el genérico: si mañana otra pantalla junta tres acciones parecidas, se usa
 * este en vez de escribir otro desplegable.
 */
export default function MenuAcciones({ label, icon: Icono, titulo, acciones }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {Icono && <Icono className="size-4" />} {label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{titulo ?? label}</DropdownMenuLabel>
        {acciones.map((a) => {
          const Item = a.icon;
          return (
            <DropdownMenuItem key={a.label} onSelect={a.onSelect}>
              {Item && <Item className="size-4" />}
              <span className="flex flex-col">
                {a.label}
                {a.nota && <span className="text-[11px] text-muted-foreground">{a.nota}</span>}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
