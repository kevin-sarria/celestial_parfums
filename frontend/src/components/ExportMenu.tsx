import { ChevronDown, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExportEntity } from './useExportEntity';

interface ExportMenuProps {
  /** Cada descarga: la entidad del backend y cómo se llama para el dueño. */
  descargas: { entity: string; label: string; nota?: string }[];
  /** Si viene, agrega la opción de subir un archivo al final del menú. */
  onImportar?: () => void;
  importarLabel?: string;
  label?: string;
}

/**
 * Varias descargas de Excel agrupadas en un solo botón.
 *
 * Existe porque una pantalla con tres exportaciones más un importar dejaba una
 * fila de botones que competía con las acciones de verdad (registrar una
 * llegada, una producción). Bajar Excel es mantenimiento, no la tarea del día:
 * cabe detrás de un clic.
 */
export default function ExportMenu({
  descargas, onImportar, importarLabel = 'Importar', label = 'Excel',
}: ExportMenuProps) {
  const { exportar, exportando } = useExportEntity();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4" /> {exportando ? 'Exportando…' : label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Descargar en Excel</DropdownMenuLabel>
        {descargas.map(d => (
          <DropdownMenuItem key={d.entity} onSelect={() => exportar(d.entity)}>
            <Download className="size-4" />
            <span className="flex flex-col">
              {d.label}
              {d.nota && <span className="text-[11px] text-muted-foreground">{d.nota}</span>}
            </span>
          </DropdownMenuItem>
        ))}
        {onImportar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onImportar}>
              <Upload className="size-4" /> {importarLabel}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
