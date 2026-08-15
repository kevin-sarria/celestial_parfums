import { useState } from 'react';
import { toast } from 'sonner';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';

/** Le entrega al navegador un archivo ya descargado, con el nombre que toca. */
export const guardarArchivo = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/**
 * Descarga en Excel los datos de una entidad.
 *
 * Vive aparte de `ExportButton` porque hay pantallas (Inventario) que ofrecen
 * varias descargas dentro de un mismo menú, y sin esto habría que copiar el
 * mismo bloque de descarga en cada sitio.
 */
export function useExportEntity() {
  const [exportando, setExportando] = useState<string | null>(null);

  const exportar = async (entity: string) => {
    setExportando(entity);
    try {
      // `descargar` lee el mensaje aunque venga como Blob: si no, un error del
      // servidor llegaría aquí como "(400)" sin decir qué pasó.
      const res = await http.descargar(urls.excel(entity).exportar);
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: `export-${entity}` }); return; }
      guardarArchivo(res.cuerpo, `export_${entity}.xlsx`);
    } finally { setExportando(null); }
  };

  return { exportar, exportando };
}
