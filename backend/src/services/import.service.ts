import { IMPORT_SPECS } from '../schemas/import.spec';
import { entityRows, sheetFromRows } from './import/core';
import { exportarCatalogo, importarCatalogo } from './import/catalogo';
import { exportarVentas, importarVentas } from './import/ventas';
import { LOOKUP_DELEGATES, exportarLookup, importarLookup } from './import/lookups';
import { exportarContenido, importarContenido } from './import/contenido';
import { exportarResto, importarResto } from './import/resto';
import * as inv from './import/inventario';
import type { EntityImportResult } from './import/core';

/**
 * Repartidor de importación/exportación por entidad.
 *
 * Este archivo tenía ~830 líneas y se partió por dominio (`import/catalogo`,
 * `import/ventas`, `import/lookups`, `import.inventario`) para respetar la
 * regla de ~500 líneas. Aquí solo queda el reparto: el router y el frontend
 * siguen llamando exactamente igual.
 *
 * Para agregar una entidad: súmala a `IMPORT_SPECS` y añade su rama en el
 * módulo de su dominio (o crea uno nuevo si no encaja en ninguno).
 */

export { bustImportCache, buildTemplate } from './import/core';
export type { EntityImportResult } from './import/core';
export { importExcel } from './import/legacy';
export type { ImportResult } from './import/legacy';

/** Exporta los datos actuales de una entidad con la estructura de su plantilla. */
export const exportEntity = async (entity: string): Promise<Buffer> => {
  if (!IMPORT_SPECS[entity]) throw new Error('Entidad no soportada');

  const lookup = await exportarLookup(entity);
  if (lookup) return sheetFromRows(entity, lookup);

  const catalogo = await exportarCatalogo(entity);
  if (catalogo) return sheetFromRows(entity, catalogo);

  const ventas = await exportarVentas(entity);
  if (ventas) return sheetFromRows(entity, ventas);

  const contenido = await exportarContenido(entity);
  if (contenido) return sheetFromRows(entity, contenido);

  const resto = await exportarResto(entity);
  if (resto) return sheetFromRows(entity, resto);

  if (entity === 'insumos') return sheetFromRows(entity, await inv.filasInsumos());
  if (entity === 'inventario') return sheetFromRows(entity, await inv.filasInventario());
  if (entity === 'devoluciones') return sheetFromRows(entity, await inv.filasDevoluciones());
  if (entity === 'movimientos') return sheetFromRows(entity, await inv.filasMovimientos());

  throw new Error('Entidad no soportada');
};

export const importEntity = async (entity: string, buffer: Buffer): Promise<EntityImportResult> => {
  const spec = IMPORT_SPECS[entity];
  if (!spec) throw new Error('Entidad no soportada');

  const { headers, rows } = entityRows(buffer);
  const result: EntityImportResult = { insertados: 0, actualizados: 0, omitidos: 0, errores: [] };

  const faltantes = spec.columnas.filter(c => c.required && !headers.includes(c.key)).map(c => c.key);
  if (faltantes.length) {
    result.errores.push(`El archivo no tiene las columnas obligatorias: ${faltantes.join(', ')}. Descarga la plantilla para ver la estructura.`);
    return result;
  }
  if (!rows.length) {
    result.errores.push('El archivo no tiene filas con datos.');
    return result;
  }

  // El libro de movimientos es SOLO de consulta: el stock es una proyección
  // suya, así que importarlo a mano lo descuadraría sin arreglo.
  if (entity === 'movimientos') {
    result.errores.push('Los movimientos de inventario solo se exportan: el stock se calcula a partir de ellos. Para corregir existencias usa la hoja "inventario" (conteo físico).');
    return result;
  }
  if (entity === 'insumos') { await inv.importarInsumos(rows, result); return result; }
  if (entity === 'inventario') { await inv.importarInventario(rows, result); return result; }

  if (LOOKUP_DELEGATES[entity]) { await importarLookup(entity, rows, result); return result; }
  if (await importarResto(entity, rows, result)) return result;
  if (await importarContenido(entity, rows, result)) return result;
  if (await importarCatalogo(entity, rows, result)) return result;
  if (await importarVentas(entity, rows, result)) return result;

  throw new Error('Entidad no soportada');
};
