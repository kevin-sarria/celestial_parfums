import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExportEntity } from './useExportEntity';

type GuardedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ExportButtonProps {
  /** Entidad del backend: perfumes, aromas, ocasiones, categorias, presentaciones, combos, descuentos, ventas, creditos, proveedores */
  entity: string;
  guardedFetch: GuardedFetch;
  /** Texto del boton: util cuando hay varias exportaciones en la misma vista. */
  label?: string;
}

/** Descarga los datos actuales de la entidad en Excel con la misma estructura de la plantilla de importacion. */
export default function ExportButton({ entity, guardedFetch, label = 'Exportar' }: ExportButtonProps) {
  const { exportar, exportando } = useExportEntity(guardedFetch);
  const loading = exportando === entity;

  return (
    <Button variant="outline" size="sm" onClick={() => exportar(entity)} disabled={loading}>
      <Download className="size-4" /> {loading ? 'Exportando…' : label}
    </Button>
  );
}
