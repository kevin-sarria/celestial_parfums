import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BASE_URL } from '../infrastructure/api/client';

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
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await guardedFetch(`${BASE_URL}/api/import/${entity}/export`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error ?? 'No se pudo exportar', { id: `export-${entity}` });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${entity}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo conectar con el servidor', { id: `export-${entity}` });
    } finally { setLoading(false); }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <Download className="size-4" /> {loading ? 'Exportando…' : label}
    </Button>
  );
}
