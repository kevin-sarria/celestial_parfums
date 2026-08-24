import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExportEntity } from './useExportEntity';

interface ExportButtonProps {
  /** Entidad del backend: perfumes, aromas, ocasiones, categorias, presentaciones, combos, descuentos, ventas, creditos, proveedores */
  entity: string;
  /** Texto del boton: util cuando hay varias exportaciones en la misma vista. */
  label?: string;
  /**
   * Solo para el Catálogo ("perfumes"): descarga una de las dos pestañas
   * —`fabricadas` o `productos`— en vez de la tabla entera.
   */
  familia?: string;
  /** Nombre del .xlsx sin extensión, cuando el de la entidad no describe lo que trae. */
  archivo?: string;
}

/** Descarga los datos actuales de la entidad en Excel con la misma estructura de la plantilla de importacion. */
export default function ExportButton({ entity, label = 'Exportar', familia, archivo }: ExportButtonProps) {
  const { exportar, exportando } = useExportEntity();
  const loading = exportando === (familia ?? entity);

  return (
    <Button variant="outline" size="sm" onClick={() => exportar(entity, { familia, archivo })} disabled={loading}>
      <Download className="size-4" /> {loading ? 'Exportando…' : label}
    </Button>
  );
}
