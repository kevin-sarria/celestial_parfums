import { prisma } from '../../config/prisma';
import { engancharTallasSueltas } from '../../repositories/costeo.repository';
import { toNum, toStr, FilaExcel } from './core';
import type { EntityImportResult } from './core';

/**
 * Las entidades que faltaban por tener importador/exportador: recetas,
 * producciones, usuarios, cotizaciones, blog y avisos de stock.
 *
 * Criterio de qué se puede IMPORTAR: solo lo que es configuración o datos que
 * el dueño teclea. Lo que es histórico contable (producciones, cotizaciones
 * emitidas) se exporta pero NO se importa — reescribirlo a mano rompería la
 * trazabilidad, igual que con los movimientos de inventario.
 */

const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
const num = (v: unknown) => Number(v);

// ── Recetas por tamaño (configuración: se importa) ──────────────────────────
export const filasFormulas = async () => {
  const rows = await prisma.formulaVolumen.findMany({
    orderBy: { ml_total: 'asc' },
    include: { envase: true, esencia: true, escalas: { orderBy: { cantidad_min: 'asc' } } },
  });
  return rows.map((f) => {
    const total = num(f.ml_total);
    return {
      nombre: f.nombre,
      ml_total: total,
      esencia_ml: num(f.esencia_ml),
      sellador_ml: num(f.sellador_ml),
      feromonas_ml: num(f.feromonas_ml),
      // El diluyente NUNCA se guarda: es el resto. Se exporta solo informativo.
      diluyente_ml: Math.round((total - num(f.esencia_ml) - num(f.sellador_ml) - num(f.feromonas_ml)) * 100) / 100,
      envase: f.envase?.nombre ?? '',
      esencia_defecto: f.esencia?.nombre ?? '',
      escalas: f.escalas.map((e) => `${e.cantidad_min}-${e.cantidad_max ?? ''}:${num(e.precio)}`).join(', '),
      activo: f.activo ? 'si' : 'no',
    };
  });
};

export const importarFormulas = async (rows: FilaExcel[], result: EntityImportResult) => {
  for (const [i, row] of rows.entries()) {
    const fila = i + 2;
    const nombre = toStr(row.nombre);
    const ml = toNum(row.ml_total);
    if (!nombre || ml <= 0) { result.omitidos++; continue; }
    const esencia = toNum(row.esencia_ml);
    const sellador = toNum(row.sellador_ml);
    const feromonas = toNum(row.feromonas_ml);
    // El diluyente es el resto: si lo demás ya supera el total, la receta no cierra
    if (esencia + sellador + feromonas > ml) {
      result.errores.push(`Fila ${fila}: la suma de esencia, sellador y feromonas supera los ${ml} ml`);
      result.omitidos++; continue;
    }
    const envase = toStr(row.envase)
      ? await prisma.insumoCosto.findFirst({ where: { nombre: toStr(row.envase) } })
      : null;
    const datos = {
      nombre, ml_total: ml, esencia_ml: esencia, sellador_ml: sellador, feromonas_ml: feromonas,
      envase_insumo_id: envase?.id ?? null,
      activo: toStr(row.activo).toLowerCase() !== 'no',
    };
    const existente = await prisma.formulaVolumen.findFirst({ where: { ml_total: ml } });
    if (existente) {
      await prisma.formulaVolumen.update({ where: { id: existente.id }, data: datos });
      result.actualizados++;
    } else {
      const creada = await prisma.formulaVolumen.create({ data: datos });
      // Misma regla que al crearla desde la pantalla, y en un solo sitio: una
      // receta nueva engancha las tallas de ese tamaño que estaban sueltas, o
      // esas ventas seguirían entrando con costo cero.
      await engancharTallasSueltas(creada.id, ml);
      result.insertados++;
    }
  }
};

// ── Solo exportación (histórico: importarlo rompería la trazabilidad) ───────

export const filasProducciones = async () => {
  const rows = await prisma.produccion.findMany({
    orderBy: [{ fecha: 'desc' }],
    include: { formula: { select: { nombre: true } }, perfume: { select: { nombre: true } } },
  });
  return rows.map((p) => ({
    fecha: fmt(p.fecha),
    fragancia: p.perfume?.nombre ?? '',
    tamano: p.formula?.nombre ?? '',
    cantidad: p.cantidad,
    costo_unitario: num(p.costo_unitario),
    costo_total: num(p.costo_total),
    nota: p.nota ?? '',
  }));
};

export const filasCotizaciones = async () => {
  const rows = await prisma.cotizacion.findMany({
    orderBy: [{ created_at: 'desc' }],
    include: { items: { include: { perfume: { select: { nombre: true } } } } },
  });
  return rows.flatMap((c) =>
    (c.items.length ? c.items : [null]).map((it) => ({
      numero: c.numero,
      fecha: fmt(c.created_at),
      tipo: c.tipo,
      cliente: c.cliente_nombre,
      empresa: c.cliente_empresa ?? '',
      telefono: c.cliente_telefono ?? '',
      estado: c.estado,
      producto: it?.perfume?.nombre ?? it?.perfume_nombre ?? '',
      tamano: it?.volumen_nombre ?? '',
      cantidad: it?.cantidad ?? 0,
      precio_unitario: it ? num(it.precio_unitario) : 0,
      subtotal: it ? num(it.subtotal) : 0,
      total_cotizacion: num(c.total),
    })),
  );
};

export const filasUsuarios = async () => {
  const rows = await prisma.user.findMany({
    where: { rol_id: { not: 1 } },
    orderBy: { nombre: 'asc' },
    select: {
      nombre: true, apellido: true, email: true, telefono: true, direccion: true,
      cupo_base: true, sin_cuenta: true, activo: true, created_at: true,
    },
  });
  return rows.map((u) => ({
    nombre: u.nombre,
    apellido: u.apellido,
    correo: u.email,
    telefono: u.telefono ?? '',
    direccion: u.direccion ?? '',
    cupo_base: num(u.cupo_base),
    // Ficha creada por el admin (sin acceso a la web) vs cuenta real
    tipo: u.sin_cuenta ? 'ficha' : 'cuenta',
    activo: u.activo ? 'si' : 'no',
    registrado: fmt(u.created_at),
  }));
};

export const filasBlog = async () => {
  const rows = await prisma.post.findMany({ orderBy: [{ created_at: 'desc' }] });
  return rows.map((p) => ({
    titulo: p.titulo,
    slug: p.slug,
    resumen: p.resumen ?? '',
    publicado: p.publicado ? 'si' : 'no',
    fecha: fmt(p.created_at),
  }));
};

export const filasAvisos = async () => {
  const rows = await prisma.avisoStock.findMany({
    orderBy: [{ created_at: 'desc' }],
    include: {
      perfume: { select: { nombre: true, agotado: true } },
      user: { select: { nombre: true, apellido: true, email: true, telefono: true } },
    },
  });
  return rows.map((a) => ({
    perfume: a.perfume?.nombre ?? '',
    agotado: a.perfume?.agotado ? 'si' : 'no',
    cliente: `${a.user?.nombre ?? ''} ${a.user?.apellido ?? ''}`.trim(),
    correo: a.user?.email ?? '',
    telefono: a.user?.telefono ?? '',
    fecha: fmt(a.created_at),
  }));
};

const SOLO_EXPORTA = ['producciones', 'cotizaciones', 'blog', 'avisos'];

export const exportarResto = async (entity: string): Promise<FilaExcel[] | null> => {
  if (entity === 'formulas') return filasFormulas();
  if (entity === 'producciones') return filasProducciones();
  if (entity === 'cotizaciones') return filasCotizaciones();
  if (entity === 'usuarios') return filasUsuarios();
  if (entity === 'blog') return filasBlog();
  if (entity === 'avisos') return filasAvisos();
  return null;
};

export const importarResto = async (
  entity: string, rows: FilaExcel[], result: EntityImportResult,
): Promise<boolean> => {
  if (SOLO_EXPORTA.includes(entity)) {
    result.errores.push('Esta hoja es solo de consulta: es histórico y reescribirlo a mano rompería la trazabilidad.');
    return true;
  }
  if (entity === 'formulas') { await importarFormulas(rows, result); return true; }
  return false;
};
