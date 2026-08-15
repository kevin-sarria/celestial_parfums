import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExportEntity } from './useExportEntity';

interface ExportButtonProps {
  /** Entidad del backend: perfumes, aromas, ocasiones, categorias, presentaciones, combos, descuentos, ventas, creditos, proveedores */
  entity: string;
  /** Texto del boton: util cuando hay varias exportaciones en la misma vista. */
  label?: string;
}

/** Descarga los datos actuales de la entidad en Excel con la misma estructura de la plantilla de importacion. */
export default function ExportButton({ entity, label = 'Exportar' }: ExportButtonProps) {
  const { exportar, exportando } = useExportEntity();
  const loading = exportando === entity;

  return (
    <Button variant="outline" size="sm" onClick={() => exportar(entity)} disabled={loading}>
      <Download className="size-4" /> {loading ? 'Exportando…' : label}
    </Button>
  );
}
