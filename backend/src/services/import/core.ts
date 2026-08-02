import * as xlsx from 'xlsx';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { IMPORT_SPECS } from '../../schemas/import.spec';
import { buildPerfumeIndex } from '../../utils/perfumeMatcher';
import { cacheClear } from '../../utils/cache';

/**
 * Piezas compartidas por todos los importadores/exportadores.
 *
 * El servicio vivía en un solo archivo de ~830 líneas; se partió por dominio
 * (catálogo, ventas, inventario, contenido) para respetar la regla de ~500
 * líneas del proyecto. El router y el frontend no cambian: siguen llamando a
 * `exportEntity`/`importEntity` de `import.service.ts`, que reparte.
 */

/** Toda importación puede tocar catálogo, ventas o anuncios: se invalida el caché público. */
export const bustImportCache = () => {
  cacheClear('parfums:');
  cacheClear('anuncios:');
};

/** Índice de perfumes para inferir el enlace venta→perfume por nombre. */
export async function loadPerfumeIndex() {
  const perfumes = await prisma.perfume.findMany({ select: { id: true, nombre: true } });
  return buildPerfumeIndex(perfumes);
}

/**
 * Busca o crea la persona (usuario/ficha) para una fila de crédito importada.
 * Sin correo conocido se genera uno sintético: la ficha no puede iniciar sesión.
 */
export async function ensurePersona(nombre: string, apellido: string, telefono: string | null, correo: string | null) {
  const existente = await prisma.user.findFirst({
    where: correo
      ? { OR: [{ email: correo }, { nombre, apellido, ...(telefono ? { telefono } : {}) }] }
      : { nombre, apellido, ...(telefono ? { telefono } : {}) },
  });
  if (existente) return { id: existente.id, creado: false };
  const email = correo && !(await prisma.user.findFirst({ where: { email: correo } }))
    ? correo
    : `ficha-${crypto.randomBytes(6).toString('hex')}@sin-cuenta.local`;
  const u = await prisma.user.create({
    data: {
      nombre, apellido, email, telefono, password: '!sin-acceso!',
      rol_id: 2, activo: false, sin_cuenta: true,
    },
  });
  return { id: u.id, creado: true };
}


export function toDate(val: any): Date {
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date((val - 25569) * 86400000);
  return new Date(val);
}

export function toStr(val: any): string {
  return val != null && val !== '' ? String(val).trim() : '';
}

export function toNullStr(val: any): string | null {
  const s = toStr(val);
  return s === '' || s === 'N/A' ? null : s;
}

export function toNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function toNullNum(val: any): number | null {
  if (val === '' || val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export function rows(ws: xlsx.WorkSheet) {
  return xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
}

export function toDateOrNull(val: any): Date | null {
  if (val === '' || val == null) return null;
  const d = toDate(val);
  return isNaN(d.getTime()) ? null : d;
}

export function splitList(val: any): string[] {
  return toStr(val)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function clampPct(val: any): number {
  const n = toNum(val);
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function lowerMap(items: { id: number; nombre: string }[]): Map<string, number> {
  return new Map(items.map(i => [i.nombre.toLowerCase(), i.id]));
}

/** Columnas de si/no: vacio cuenta como "si" (es el valor por defecto del sistema). */
export function toBool(val: any, porDefecto = true): boolean {
  const s = toStr(val).toLowerCase();
  if (s === '') return porDefecto;
  return !['no', 'false', '0', 'n'].includes(s);
}

/** Lee la primera hoja del libro con encabezados normalizados (minusculas, sin espacios extra). */
export function entityRows(buffer: Buffer): { headers: string[]; rows: Record<string, any>[] } {
  const wb = xlsx.read(buffer, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };
  const aoa = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  if (!aoa.length) return { headers: [], rows: [] };
  const headers = (aoa[0] ?? []).map(h => toStr(h).toLowerCase());
  const rows = aoa.slice(1).map(cells => {
    const o: Record<string, any> = {};
    headers.forEach((h, i) => { if (h) o[h] = cells?.[i] ?? ''; });
    return o;
  }).filter(r => Object.values(r).some(v => toStr(v) !== ''));
  return { headers, rows };
}

export interface EntityImportResult {
  insertados: number;
  actualizados: number;
  omitidos: number;
  errores: string[];
  /** Mensajes informativos (no son errores), ej: cuántas ventas quedaron enlazadas. */
  info?: string[];
}

export const buildTemplate = (entity: string): Buffer => {
  const spec = IMPORT_SPECS[entity];
  if (!spec) throw new Error('Entidad no soportada');
  const headers = spec.columnas.map(c => c.key);
  const example = spec.columnas.map(c => c.ejemplo);
  const ws = xlsx.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map((h, i) => ({ wch: Math.max(h.length, String(example[i]).length) + 4 }));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Datos');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sheetFromRows(entity: string, rows: Record<string, any>[]): Buffer {
  const spec = IMPORT_SPECS[entity];
  const headers = spec.columnas.map(c => c.key);
  const aoa = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
  const ws = xlsx.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(60, Math.max(h.length, ...aoa.slice(1).map(row => String(row[i] ?? '').length)) + 4),
  }));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Datos');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Exporta los datos actuales de una entidad con la misma estructura de la plantilla de importacion. */
