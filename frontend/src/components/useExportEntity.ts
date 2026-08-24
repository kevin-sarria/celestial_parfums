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
/** Cómo acotar una exportación (hoy solo el Catálogo la necesita). */
export interface OpcionesExport {
  /** Familia del catálogo: `fabricadas` o `productos`. Sin ella, la tabla entera. */
  familia?: string;
  /** Nombre del .xlsx sin extensión. Por defecto, el de la entidad. */
  archivo?: string;
}

export function useExportEntity() {
  const [exportando, setExportando] = useState<string | null>(null);

  const exportar = async (entity: string, opciones: OpcionesExport = {}) => {
    const { familia, archivo } = opciones;
    // La clave del "Exportando…" incluye la familia: Perfumes y Productos son
    // la misma entidad, y sin esto el botón de una pestaña se veía cargando
    // mientras descargaba la otra.
    setExportando(familia ?? entity);
    try {
      // `descargar` lee el mensaje aunque venga como Blob: si no, un error del
      // servidor llegaría aquí como "(400)" sin decir qué pasó.
      const res = await http.descargar(urls.excel(entity).exportar(familia));
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: `export-${entity}` }); return; }
      // Dos descargas llamadas "export_perfumes.xlsx" con contenidos distintos
      // se confunden en la carpeta de Descargas, así que quien acota la
      // exportación también le pone nombre al archivo.
      guardarArchivo(res.cuerpo, `export_${archivo ?? entity}.xlsx`);
    } finally { setExportando(null); }
  };

  return { exportar, exportando };
}
