import { useState } from 'react';
import { toast } from 'sonner';
import { BASE_URL } from '../infrastructure/api/client';

type GuardedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Descarga en Excel los datos de una entidad.
 *
 * Vive aparte de `ExportButton` porque hay pantallas (Inventario) que ofrecen
 * varias descargas dentro de un mismo menú, y sin esto habría que copiar el
 * mismo bloque de descarga en cada sitio.
 */
export function useExportEntity(guardedFetch: GuardedFetch) {
  const [exportando, setExportando] = useState<string | null>(null);

  const exportar = async (entity: string) => {
    setExportando(entity);
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
    } finally { setExportando(null); }
  };

  return { exportar, exportando };
}
