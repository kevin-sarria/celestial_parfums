import * as xlsx from 'xlsx';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { IMPORT_SPECS } from '../schemas/import.spec';
import { agruparEnlaces, buildPerfumeIndex, matchPerfumes } from '../utils/perfumeMatcher';
import { cacheClear } from '../utils/cache';

/** Toda importación puede tocar catálogo o ventas: se invalida el caché público. */
export const bustImportCache = () => cacheClear('parfums:');

/** Índice de perfumes para inferir el enlace venta→perfume por nombre. */
async function loadPerfumeIndex() {
  const perfumes = await prisma.perfume.findMany({ select: { id: true, nombre: true } });
  return buildPerfumeIndex(perfumes);
}

/**
 * Busca o crea la persona (usuario/ficha) para una fila de crédito importada.
 * Sin correo conocido se genera uno sintético: la ficha no puede iniciar sesión.
 */
async function ensurePersona(nombre: string, apellido: string, telefono: string | null, correo: string | null) {
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

function toDate(val: any): Date {
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date((val - 25569) * 86400000);
  return new Date(val);
}

function toStr(val: any): string {
  return val != null && val !== '' ? String(val).trim() : '';
}

function toNullStr(val: any): string | null {
  const s = toStr(val);
  return s === '' || s === 'N/A' ? null : s;
}

function toNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toNullNum(val: any): number | null {
  if (val === '' || val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function rows(ws: xlsx.WorkSheet) {
  return xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
}

function toDateOrNull(val: any): Date | null {
  if (val === '' || val == null) return null;
  const d = toDate(val);
  return isNaN(d.getTime()) ? null : d;
}

function splitList(val: any): string[] {
  return toStr(val)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function clampPct(val: any): number {
  const n = toNum(val);
  return Math.max(0, Math.min(100, Math.round(n)));
}

function lowerMap(items: { id: number; nombre: string }[]): Map<string, number> {
  return new Map(items.map(i => [i.nombre.toLowerCase(), i.id]));
}

/** Lee la primera hoja del libro con encabezados normalizados (minusculas, sin espacios extra). */
function entityRows(buffer: Buffer): { headers: string[]; rows: Record<string, any>[] } {
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

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sheetFromRows(entity: string, rows: Record<string, any>[]): Buffer {
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
export const exportEntity = async (entity: string): Promise<Buffer> => {
  if (!IMPORT_SPECS[entity]) throw new Error('Entidad no soportada');

  if (LOOKUP_DELEGATES[entity]) {
    const items = await LOOKUP_DELEGATES[entity]().findMany({ orderBy: { nombre: 'asc' } });
    return sheetFromRows(entity, items.map((i: any) => ({ nombre: i.nombre })));
  }

  if (entity === 'perfumes') {
    const perfumes = await prisma.perfume.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        categoria: true,
        tipos_aroma: { include: { tipo_aroma: true } },
        ocasiones: { include: { ocasion: true } },
        presentaciones: { include: { presentacion: true } },
      },
    });
    return sheetFromRows(entity, perfumes.map(p => ({
      nombre: p.nombre,
      precio: Number(p.precio),
      descripcion: p.descripcion ?? '',
      duracion: p.duracion ?? '',
      proyeccion: p.proyeccion ?? '',
      genero: p.genero ?? '',
      categoria: p.categoria?.nombre ?? '',
      image_url: p.imagen_url ?? '',
      tipos_aroma: p.tipos_aroma.map(t => t.tipo_aroma.nombre).join(', '),
      ocasiones: p.ocasiones.map(o => o.ocasion.nombre).join(', '),
      presentaciones: p.presentaciones.map(pr => pr.presentacion.nombre).join(', '),
      descuento: p.descuento,
    })));
  }

  if (entity === 'combos') {
    const combos = await prisma.combo.findMany({ orderBy: { nombre: 'asc' }, include: { categoria: true } });
    return sheetFromRows(entity, combos.map(c => ({
      nombre: c.nombre,
      precio: Number(c.precio),
      cantidad: c.cantidad,
      descripcion: c.descripcion ?? '',
      categoria: c.categoria?.nombre ?? '',
      image_url: c.imagen_url ?? '',
      descuento: c.descuento,
      activo: c.activo ? 'si' : 'no',
    })));
  }

  if (entity === 'descuentos') {
    const [perfumes, combos] = await Promise.all([
      prisma.perfume.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true, descuento: true } }),
      prisma.combo.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true, descuento: true } }),
    ]);
    return sheetFromRows(entity, [
      ...perfumes.map(p => ({ tipo: 'perfume', nombre: p.nombre, descuento: p.descuento })),
      ...combos.map(c => ({ tipo: 'combo', nombre: c.nombre, descuento: c.descuento })),
    ]);
  }

  if (entity === 'ventas') {
    const ventas = await prisma.venta.findMany({ orderBy: { dia: 'asc' } });
    return sheetFromRows(entity, ventas.map(v => ({
      dia: fmtDate(v.dia),
      persona: v.persona,
      cantidad_perfumes: v.cantidad_perfumes,
      presentacion: v.presentacion,
      referencia_perfume: v.referencia_perfume,
      valor_venta: Number(v.valor_venta),
      datos_adicionales: v.datos_adicionales ?? '',
    })));
  }

  if (entity === 'creditos') {
    const creditos = await prisma.credito.findMany({
      orderBy: { fecha: 'asc' },
      include: { user: true, abonos: { orderBy: { fecha: 'asc' } } },
    });
    return sheetFromRows(entity, creditos.map(c => ({
      fecha: fmtDate(c.fecha),
      nombre_cliente: c.user.nombre,
      apellido_cliente: c.user.apellido,
      telefono: c.user.telefono ?? '',
      correo: c.user.sin_cuenta ? '' : c.user.email,
      articulos: c.articulos,
      deuda_inicial: Number(c.deuda_inicial),
      abonos: c.abonos.map(a => Number(a.monto)).join(', '),
    })));
  }

  if (entity === 'proveedores') {
    const pagos = await prisma.pagoProveedor.findMany({ orderBy: { dia: 'asc' }, include: { empresa: true } });
    return sheetFromRows(entity, pagos.map(p => ({
      dia: fmtDate(p.dia),
      empresa: p.empresa.nombre,
      valor_compra: Number(p.valor_compra),
      coste_envio: Number(p.coste_envio),
      detalles_adicionales: p.detalles_adicionales ?? '',
    })));
  }

  throw new Error('Entidad no soportada');
};

const LOOKUP_DELEGATES: Record<string, any> = {
  aromas: () => prisma.tipoAroma,
  ocasiones: () => prisma.ocasion,
  categorias: () => prisma.categoria,
  presentaciones: () => prisma.presentacion,
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

  // ── Lookups simples (aromas, ocasiones, categorias, presentaciones) ─────────
  if (LOOKUP_DELEGATES[entity]) {
    const nombres = [...new Set(rows.map(r => toStr(r['nombre'])).filter(Boolean))];
    const created = await LOOKUP_DELEGATES[entity]().createMany({
      data: nombres.map(nombre => ({ nombre })),
      skipDuplicates: true,
    });
    result.insertados = created.count;
    result.omitidos = nombres.length - created.count;
    return result;
  }

  // ── Perfumes ────────────────────────────────────────────────────────────────
  if (entity === 'perfumes') {
    const [aromas, ocasiones, presentaciones, categorias] = await Promise.all([
      prisma.tipoAroma.findMany(), prisma.ocasion.findMany(),
      prisma.presentacion.findMany(), prisma.categoria.findMany(),
    ]);
    const aromaMap = lowerMap(aromas);
    const ocasionMap = lowerMap(ocasiones);
    const presMap = lowerMap(presentaciones);
    const catMap = lowerMap(categorias);
    const ids = (val: any, map: Map<string, number>) =>
      [...new Set(splitList(val).map(n => map.get(n.toLowerCase())).filter((x): x is number => x != null))];

    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const nombre = toStr(r['nombre']);
      if (!nombre) { result.errores.push(`Fila ${fila}: el nombre es obligatorio`); result.omitidos++; continue; }
      if (toStr(r['precio']) === '' || isNaN(Number(r['precio']))) {
        result.errores.push(`Fila ${fila} (${nombre}): el precio es obligatorio y debe ser numerico`); result.omitidos++; continue;
      }
      // Acepta la terminologia nueva y traduce la antigua (hombre/mujer) por compatibilidad
      const generoRaw = toStr(r['genero']).toLowerCase();
      const generoStr = generoRaw === 'hombre' ? 'caballero' : generoRaw === 'mujer' ? 'dama' : generoRaw;
      try {
        await prisma.perfume.create({
          data: {
            nombre,
            descripcion: toNullStr(r['descripcion']),
            precio: toNum(r['precio']),
            duracion: toNullStr(r['duracion']),
            proyeccion: toNullStr(r['proyeccion']),
            imagen_url: toNullStr(r['image_url']),
            genero: generoStr === 'dama' || generoStr === 'caballero' || generoStr === 'unisex' ? generoStr : null,
            categoria_id: catMap.get(toStr(r['categoria']).toLowerCase()) ?? null,
            descuento: clampPct(r['descuento']),
            tipos_aroma: { create: ids(r['tipos_aroma'], aromaMap).map(id => ({ tipo_aroma_id: id })) },
            ocasiones: { create: ids(r['ocasiones'], ocasionMap).map(id => ({ ocasion_id: id })) },
            presentaciones: { create: ids(r['presentaciones'], presMap).map(id => ({ presentacion_id: id })) },
          },
        });
        result.insertados++;
      } catch (e: any) {
        result.errores.push(`Fila ${fila} (${nombre}): ${e.message}`);
        result.omitidos++;
      }
    }
    return result;
  }

  // ── Combos ──────────────────────────────────────────────────────────────────
  if (entity === 'combos') {
    const categorias = await prisma.categoria.findMany();
    const catMap = lowerMap(categorias);

    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const nombre = toStr(r['nombre']);
      if (!nombre) { result.errores.push(`Fila ${fila}: el nombre es obligatorio`); result.omitidos++; continue; }
      if (toStr(r['precio']) === '' || isNaN(Number(r['precio']))) {
        result.errores.push(`Fila ${fila} (${nombre}): el precio es obligatorio y debe ser numerico`); result.omitidos++; continue;
      }
      const cantidad = toNum(r['cantidad']);
      if (cantidad < 1) { result.errores.push(`Fila ${fila} (${nombre}): la cantidad debe ser mayor a 0`); result.omitidos++; continue; }
      const activoStr = toStr(r['activo']).toLowerCase();
      try {
        await prisma.combo.create({
          data: {
            nombre,
            descripcion: toNullStr(r['descripcion']),
            imagen_url: toNullStr(r['image_url']),
            categoria_id: catMap.get(toStr(r['categoria']).toLowerCase()) ?? null,
            cantidad,
            precio: toNum(r['precio']),
            descuento: clampPct(r['descuento']),
            activo: !['no', 'false', '0'].includes(activoStr),
          },
        });
        result.insertados++;
      } catch (e: any) {
        result.errores.push(`Fila ${fila} (${nombre}): ${e.message}`);
        result.omitidos++;
      }
    }
    return result;
  }

  // ── Descuentos (actualiza perfumes o combos existentes) ─────────────────────
  if (entity === 'descuentos') {
    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const tipo = toStr(r['tipo']).toLowerCase();
      const nombre = toStr(r['nombre']);
      if (!nombre) { result.errores.push(`Fila ${fila}: el nombre es obligatorio`); result.omitidos++; continue; }
      if (tipo !== 'perfume' && tipo !== 'combo') {
        result.errores.push(`Fila ${fila} (${nombre}): el tipo debe ser "perfume" o "combo"`); result.omitidos++; continue;
      }
      const descuento = clampPct(r['descuento']);
      try {
        const updated = tipo === 'perfume'
          ? await prisma.perfume.updateMany({ where: { nombre }, data: { descuento } })
          : await prisma.combo.updateMany({ where: { nombre }, data: { descuento } });
        if (updated.count === 0) {
          result.errores.push(`Fila ${fila}: no se encontro ningun ${tipo} llamado "${nombre}"`);
          result.omitidos++;
        } else {
          result.actualizados += updated.count;
        }
      } catch (e: any) {
        result.errores.push(`Fila ${fila} (${nombre}): ${e.message}`);
        result.omitidos++;
      }
    }
    return result;
  }

  // ── Ventas ──────────────────────────────────────────────────────────────────
  if (entity === 'ventas') {
    const perfumeIndex = await loadPerfumeIndex();
    let enlazadas = 0;
    const data: any[] = [];
    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const dia = toDateOrNull(r['dia']);
      const persona = toStr(r['persona']);
      const referencia = toStr(r['referencia_perfume']);
      if (!dia) { result.errores.push(`Fila ${fila}: la fecha (dia) es obligatoria y debe ser valida`); result.omitidos++; continue; }
      if (!persona || !referencia) { result.errores.push(`Fila ${fila}: persona y referencia_perfume son obligatorios`); result.omitidos++; continue; }
      if (toStr(r['valor_venta']) === '' || isNaN(Number(r['valor_venta']))) {
        result.errores.push(`Fila ${fila} (${persona}): el valor_venta es obligatorio y debe ser numerico`); result.omitidos++; continue;
      }
      const perfumeIds = matchPerfumes(referencia, perfumeIndex);
      if (perfumeIds.length) enlazadas++;
      data.push({
        dia,
        persona,
        cantidad_perfumes: toNum(r['cantidad_perfumes']) || 1,
        presentacion: (toStr(r['presentacion']) || '30ML').slice(0, 100),
        referencia_perfume: referencia,
        perfume_ids: perfumeIds,
        valor_venta: toNum(r['valor_venta']),
        datos_adicionales: toNullStr(r['datos_adicionales']),
      });
    }
    // create fila a fila (no createMany) para poder anidar los enlaces a perfumes
    for (const { perfume_ids, ...venta } of data) {
      try {
        await prisma.venta.create({
          data: { ...venta, perfumes: { create: agruparEnlaces(perfume_ids) } },
        });
        result.insertados++;
      } catch (e: any) {
        result.errores.push(`Venta (${venta.persona}): ${e.message}`);
        result.omitidos++;
      }
    }
    if (data.length) {
      result.info = [`${enlazadas} de ${data.length} ventas quedaron enlazadas a perfumes del catalogo por nombre.`];
    }
    return result;
  }

  // ── Creditos (crea o reutiliza el cliente) ──────────────────────────────────
  if (entity === 'creditos') {
    const clienteCache: Record<string, number> = {};
    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const fecha = toDateOrNull(r['fecha']);
      const nombre = toStr(r['nombre_cliente']);
      const apellido = toStr(r['apellido_cliente']);
      const articulos = toStr(r['articulos']);
      if (!fecha) { result.errores.push(`Fila ${fila}: la fecha es obligatoria y debe ser valida`); result.omitidos++; continue; }
      if (!nombre || !apellido) { result.errores.push(`Fila ${fila}: nombre_cliente y apellido_cliente son obligatorios`); result.omitidos++; continue; }
      if (!articulos) { result.errores.push(`Fila ${fila} (${nombre} ${apellido}): los articulos son obligatorios`); result.omitidos++; continue; }
      if (toStr(r['deuda_inicial']) === '' || isNaN(Number(r['deuda_inicial']))) {
        result.errores.push(`Fila ${fila} (${nombre} ${apellido}): la deuda_inicial es obligatoria y debe ser numerica`); result.omitidos++; continue;
      }
      const telefono = toNullStr(r['telefono']);
      const key = `${nombre.toLowerCase()}|${apellido.toLowerCase()}|${telefono ?? ''}`;
      try {
        if (!clienteCache[key]) {
          const persona = await ensurePersona(nombre, apellido, telefono, toNullStr(r['correo']));
          clienteCache[key] = persona.id;
        }
        const abonos = splitList(r['abonos'])
          .map(Number)
          .filter(n => !isNaN(n) && n > 0)
          .map(monto => ({ monto, fecha }));
        await prisma.credito.create({
          data: {
            fecha,
            user_id: clienteCache[key],
            articulos,
            deuda_inicial: toNum(r['deuda_inicial']),
            abonos: { create: abonos },
          },
        });
        result.insertados++;
      } catch (e: any) {
        result.errores.push(`Fila ${fila} (${nombre} ${apellido}): ${e.message}`);
        result.omitidos++;
      }
    }
    return result;
  }

  // ── Proveedores (pagos, crea la empresa si no existe) ───────────────────────
  if (entity === 'proveedores') {
    const empresas = await prisma.empresa.findMany();
    const empresaMap = lowerMap(empresas);
    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const dia = toDateOrNull(r['dia']);
      const empresaNombre = toStr(r['empresa']);
      if (!dia) { result.errores.push(`Fila ${fila}: la fecha (dia) es obligatoria y debe ser valida`); result.omitidos++; continue; }
      if (!empresaNombre) { result.errores.push(`Fila ${fila}: la empresa es obligatoria`); result.omitidos++; continue; }
      if (toStr(r['valor_compra']) === '' || isNaN(Number(r['valor_compra']))) {
        result.errores.push(`Fila ${fila} (${empresaNombre}): el valor_compra es obligatorio y debe ser numerico`); result.omitidos++; continue;
      }
      try {
        let empresaId = empresaMap.get(empresaNombre.toLowerCase());
        if (!empresaId) {
          const e = await prisma.empresa.create({ data: { nombre: empresaNombre } });
          empresaId = e.id;
          empresaMap.set(empresaNombre.toLowerCase(), e.id);
        }
        await prisma.pagoProveedor.create({
          data: {
            dia,
            empresa_id: empresaId,
            valor_compra: toNum(r['valor_compra']),
            coste_envio: toNum(r['coste_envio']),
            detalles_adicionales: toNullStr(r['detalles_adicionales']),
          },
        });
        result.insertados++;
      } catch (e: any) {
        result.errores.push(`Fila ${fila} (${empresaNombre}): ${e.message}`);
        result.omitidos++;
      }
    }
    return result;
  }

  throw new Error('Entidad no soportada');
};

export interface ImportResult {
  ventas: number;
  clientes_creados: number;
  creditos: number;
  empresas_creadas: number;
  pagos: number;
  errores: string[];
}

export const importExcel = async (buffer: Buffer): Promise<ImportResult> => {
  const wb = xlsx.read(buffer, { cellDates: true });
  const result: ImportResult = {
    ventas: 0,
    clientes_creados: 0,
    creditos: 0,
    empresas_creadas: 0,
    pagos: 0,
    errores: [],
  };

  // ── VENTAS ──────────────────────────────────────────────────────────────────
  if (wb.SheetNames.includes('Ventas')) {
    const perfumeIndex = await loadPerfumeIndex();
    const data = rows(wb.Sheets['Ventas'])
      .filter(r => r['Dia'] && r['Persona'])
      .map(r => ({
        dia:                 toDate(r['Dia']),
        persona:             toStr(r['Persona']),
        cantidad_perfumes:   toNum(r['Cantidad Perfumes']) || 1,
        presentacion:        toStr(r['Presentacion Perfumes']).slice(0, 100),
        referencia_perfume:  toStr(r['Referencia Perfume']),
        perfume_ids:         matchPerfumes(toStr(r['Referencia Perfume']), perfumeIndex),
        valor_venta:         toNum(r['Valor Venta']),
        datos_adicionales:   toNullStr(r['Datos Adicionales Venta']),
      }));

    for (const { perfume_ids, ...venta } of data) {
      try {
        await prisma.venta.create({
          data: { ...venta, perfumes: { create: agruparEnlaces(perfume_ids) } },
        });
        result.ventas++;
      } catch (e: any) {
        result.errores.push(`Venta (${venta.persona}): ${e.message}`);
      }
    }
  }

  // ── CRÉDITOS ─────────────────────────────────────────────────────────────────
  if (wb.SheetNames.includes('Creditos')) {
    // Cache cliente por nombre+apellido+celular para no duplicarlos
    const clienteCache: Record<string, number> = {};

    const creditoRows = rows(wb.Sheets['Creditos']).filter(
      r => r['Fecha'] && r['Nombre'],
    );

    for (const r of creditoRows) {
      const nombre   = toStr(r['Nombre']);
      const apellido = toStr(r['Apellido']);
      const celular  = toNullStr(r['Celular']);
      const key      = `${nombre}|${apellido}|${celular ?? ''}`;

      try {
        if (!clienteCache[key]) {
          const persona = await ensurePersona(nombre, apellido, celular, toNullStr(r['Correo']));
          clienteCache[key] = persona.id;
          if (persona.creado) result.clientes_creados++;
        }

        const ab = (n: number) => toNullNum(r[`Abono ${n}`]);
        const abonosData = Array.from({ length: 10 }, (_, i) => ab(i + 1))
          .filter((v): v is number => v !== null)
          .map(monto => ({ monto, fecha: toDate(r['Fecha']) }));

        await prisma.credito.create({
          data: {
            fecha:         toDate(r['Fecha']),
            user_id:       clienteCache[key],
            articulos:     toStr(r['Articulos']),
            deuda_inicial: toNum(r['Deuda Inicial']),
            abonos:        { create: abonosData },
          },
        });
        result.creditos++;
      } catch (e: any) {
        result.errores.push(`Crédito (${nombre} ${apellido}): ${e.message}`);
      }
    }
  }

  // ── PAGOS ────────────────────────────────────────────────────────────────────
  if (wb.SheetNames.includes('Pagos')) {
    const empresaCache: Record<string, number> = {};

    const pagoRows = rows(wb.Sheets['Pagos']).filter(
      r => r['Dia'] && r['Empresa'],
    );

    for (const r of pagoRows) {
      const nombre = toStr(r['Empresa']);

      try {
        if (!empresaCache[nombre]) {
          const e = await prisma.empresa.create({ data: { nombre } });
          empresaCache[nombre] = e.id;
          result.empresas_creadas++;
        }

        await prisma.pagoProveedor.create({
          data: {
            dia:                  toDate(r['Dia']),
            empresa_id:           empresaCache[nombre],
            valor_compra:         toNum(r['Valor Compra']),
            coste_envio:          toNum(r['Coste de Envio']),
            detalles_adicionales: toNullStr(r['Detalles adicionales']),
          },
        });
        result.pagos++;
      } catch (e: any) {
        result.errores.push(`Pago (${nombre}): ${e.message}`);
      }
    }
  }

  return result;
};
