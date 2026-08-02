import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { agruparEnlaces, buildPerfumeIndex, matchPerfumes } from '../../utils/perfumeMatcher';
import {
  clampPct, fmtDate, lowerMap, splitList, toBool, toDate, toDateOrNull,
  toNullNum, toNullStr, toNum, toStr, loadPerfumeIndex, ensurePersona,
} from './core';
import type { EntityImportResult } from './core';

/**
 * Importación/exportación del movimiento del negocio: publicidad, ventas,
 * créditos y pagos a proveedores.
 *
 * Separado de `import.service.ts` para respetar la regla de ~500 líneas.
 */

/** Filas de exportación (null = la entidad no es de este módulo). */
export const exportarVentas = async (entity: string): Promise<Record<string, any>[] | null> => {
  if (entity === 'publicidad') {
    // Los códigos ya emitidos NO viajan en el archivo: son de cada persona.
    const anuncios = await prisma.anuncio.findMany({
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      include: { categorias: { include: { categoria: true } } },
    });
    return anuncios.map(a => ({
      titulo: a.titulo,
      tipo: a.tipo,
      mensaje: a.mensaje ?? '',
      image_url: a.imagen_url ?? '',
      audiencia: a.audiencia,
      activo: a.activo ? 'si' : 'no',
      una_vez: a.una_vez ? 'si' : 'no',
      orden: a.orden,
      inicio: a.inicio ? fmtDate(a.inicio) : '',
      fin: a.fin ? fmtDate(a.fin) : '',
      descuento_pct: a.descuento_pct,
      categorias: a.categorias.map(c => c.categoria.nombre).join(', '),
      aplica_combos: a.aplica_combos ? 'si' : 'no',
      min_unidades: a.min_unidades,
      min_monto: Number(a.min_monto),
      max_descuento: Number(a.max_descuento),
      max_canjes: a.max_canjes,
    }));
  }

  if (entity === 'ventas') {
    const ventas = await prisma.venta.findMany({ orderBy: { dia: 'asc' } });
    return ventas.map(v => ({
      dia: fmtDate(v.dia),
      persona: v.persona,
      cantidad_perfumes: v.cantidad_perfumes,
      presentacion: v.presentacion,
      referencia_perfume: v.referencia_perfume,
      valor_venta: Number(v.valor_venta),
      datos_adicionales: v.datos_adicionales ?? '',
    }));
  }

  if (entity === 'creditos') {
    const creditos = await prisma.credito.findMany({
      orderBy: { fecha: 'asc' },
      include: { user: true, abonos: { orderBy: { fecha: 'asc' } } },
    });
    return creditos.map(c => ({
      fecha: fmtDate(c.fecha),
      nombre_cliente: c.user.nombre,
      apellido_cliente: c.user.apellido,
      telefono: c.user.telefono ?? '',
      correo: c.user.sin_cuenta ? '' : c.user.email,
      articulos: c.articulos,
      deuda_inicial: Number(c.deuda_inicial),
      abonos: c.abonos.map(a => Number(a.monto)).join(', '),
    }));
  }

  if (entity === 'proveedores') {
    const pagos = await prisma.pagoProveedor.findMany({ orderBy: { dia: 'asc' }, include: { empresa: true } });
    return pagos.map(p => ({
      dia: fmtDate(p.dia),
      empresa: p.empresa.nombre,
      valor_compra: Number(p.valor_compra),
      coste_envio: Number(p.coste_envio),
      detalles_adicionales: p.detalles_adicionales ?? '',
    }));
  }

  return null;
};

/** Importadores. Devuelve true si la entidad es de este módulo. */
export const importarVentas = async (
  entity: string, rows: Record<string, any>[], result: EntityImportResult,
): Promise<boolean> => {
  if (entity === 'publicidad') {
    const categorias = await prisma.categoria.findMany();
    const catMap = lowerMap(categorias);
    const TIPOS = ['imagen', 'mensaje', 'descuento'];
    const AUDIENCIAS = ['todos', 'no_registrados', 'registrados'];

    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const titulo = toStr(r['titulo']);
      if (!titulo) { result.errores.push(`Fila ${fila}: el titulo es obligatorio`); result.omitidos++; continue; }

      const tipo = toStr(r['tipo']).toLowerCase() || 'mensaje';
      if (!TIPOS.includes(tipo)) {
        result.errores.push(`Fila ${fila} (${titulo}): el tipo debe ser "mensaje", "imagen" o "descuento"`);
        result.omitidos++; continue;
      }
      const audienciaRaw = toStr(r['audiencia']).toLowerCase() || 'todos';
      if (!AUDIENCIAS.includes(audienciaRaw)) {
        result.errores.push(`Fila ${fila} (${titulo}): la audiencia debe ser "todos", "registrados" o "no_registrados"`);
        result.omitidos++; continue;
      }
      // Un anuncio de imagen sin imagen no se vería en el catálogo
      const imagen = toNullStr(r['image_url']);
      if (tipo === 'imagen' && !imagen) {
        result.errores.push(`Fila ${fila} (${titulo}): un anuncio de tipo imagen necesita image_url`);
        result.omitidos++; continue;
      }
      // Las reglas de cupón solo tienen sentido en los anuncios de descuento
      const esCupon = tipo === 'descuento';
      const catIds = esCupon
        ? [...new Set(splitList(r['categorias']).map(n => catMap.get(n.toLowerCase())).filter((x): x is number => x != null))]
        : [];

      try {
        await prisma.anuncio.create({
          data: {
            titulo,
            mensaje: toNullStr(r['mensaje']),
            imagen_url: imagen,
            tipo: tipo as any,
            audiencia: audienciaRaw as any,
            una_vez: toBool(r['una_vez']),
            activo: toBool(r['activo']),
            orden: Math.max(0, Math.round(toNum(r['orden']))),
            inicio: toDateOrNull(r['inicio']),
            fin: toDateOrNull(r['fin']),
            descuento_pct: esCupon ? clampPct(r['descuento_pct']) : 0,
            aplica_combos: esCupon && toBool(r['aplica_combos'], false),
            min_unidades: esCupon ? Math.max(0, Math.round(toNum(r['min_unidades']))) : 0,
            min_monto: esCupon ? Math.max(0, toNum(r['min_monto'])) : 0,
            max_descuento: esCupon ? Math.max(0, toNum(r['max_descuento'])) : 0,
            max_canjes: esCupon ? Math.max(0, Math.round(toNum(r['max_canjes']))) : 0,
            categorias: { create: catIds.map(id => ({ categoria_id: id })) },
          },
        });
        result.insertados++;
      } catch (e: any) {
        result.errores.push(`Fila ${fila} (${titulo}): ${e.message}`);
        result.omitidos++;
      }
    }
    return true;
  }

  // ── Descuentos (actualiza perfumes o combos existentes) ─────────────────────

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
    return true;
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
    return true;
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
    return true;
  }

  return false;
};
