import { prisma } from '../../config/prisma';
import { ajustarStock } from '../../repositories/inventario.repository';
import type { EntityImportResult } from './core';

/**
 * Importación/exportación de las entidades del inventario y las devoluciones.
 *
 * Vive aparte de `import.service.ts` porque ese archivo ya rondaba las 800
 * líneas; el router y el frontend no se enteran: siguen llamando a
 * `exportEntity`/`importEntity`, que delegan aquí.
 */

const num = (v: unknown) => Number(String(v ?? '').toString().replace(/[^\d.-]/g, '')) || 0;
const txt = (v: unknown) => String(v ?? '').trim();

const TIPOS_VALIDOS = ['materia_prima', 'envase', 'accesorio'];

/** Para comparar nombres sin que una tilde o un espacio de más creen un duplicado. */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

/** Insumos con su costo y existencias actuales. */
export const filasInsumos = async () => {
  const rows = await prisma.insumoCosto.findMany({
    include: { gama: true }, orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  });
  return rows.map((i) => ({
    nombre: i.nombre,
    tipo: i.tipo,
    gama: i.gama?.nombre ?? '',
    genero: i.genero ?? '',
    unidad: i.unidad,
    alcance: i.alcance,
    costo_promedio: Number(i.precio),
    existencias: Number(i.stock),
    activo: i.activo ? 'si' : 'no',
  }));
};

/**
 * Hoja de conteo físico: se exporta con lo que el sistema cree que hay para
 * imprimirla, contar al lado del estante y volverla a subir con lo real.
 */
export const filasInventario = async () => {
  const rows = await prisma.insumoCosto.findMany({
    where: { activo: true }, orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  });
  return rows.map((i) => ({
    insumo: i.nombre,
    // Va en la hoja para que, al agregar una fila nueva a mano, se sepa qué
    // escribir: sin el tipo no se puede crear el material al subirla.
    tipo: i.tipo,
    unidad: i.unidad,
    existencias_sistema: Number(i.stock),
    cantidad_real: Number(i.stock),
    costo_unitario: Number(i.precio),
  }));
};

export const filasDevoluciones = async () => {
  const rows = await prisma.devolucion.findMany({
    orderBy: [{ fecha: 'desc' }], include: { venta: true },
  });
  return rows.map((d) => ({
    venta_id: d.venta_id,
    cliente: d.venta?.persona ?? '',
    fecha: fmtDate(d.fecha),
    motivo: d.motivo,
    detalle: d.detalle ?? '',
    estado: d.estado,
    solucion: d.solucion ?? '',
    monto_devuelto: Number(d.monto_devuelto),
    costo_reposicion: Number(d.costo_reposicion),
    costo_envio: Number(d.costo_envio),
    fecha_resolucion: fmtDate(d.fecha_resolucion),
    origen: d.origen,
    notas: d.notas ?? '',
  }));
};

/** Movimientos de inventario: el libro completo, solo para consultar. */
export const filasMovimientos = async () => {
  const rows = await prisma.movimientoInventario.findMany({
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: 5000,
    include: { insumo: { select: { nombre: true, unidad: true } } },
  });
  return rows.map((m) => ({
    fecha: fmtDate(m.fecha),
    insumo: m.insumo?.nombre ?? '',
    tipo: m.tipo,
    cantidad: Number(m.cantidad),
    unidad: m.insumo?.unidad ?? '',
    costo_unitario: Number(m.costo_unitario),
    valor: Math.round(Number(m.cantidad) * Number(m.costo_unitario) * 100) / 100,
    nota: m.nota ?? '',
  }));
};

// ── Importadores ────────────────────────────────────────────────────────────

const TIPOS = ['materia_prima', 'envase', 'accesorio'];

/**
 * Índice de las gamas por nombre normalizado (sin tildes ni mayúsculas): en un
 * Excel nadie escribe "Árabe" dos veces igual.
 *
 * NO hay lista fija en el código: las gamas son una tabla que el dueño amplía
 * ("nicho", "nicho premium"…), así que se acepta cualquiera que exista.
 */
const indiceGamas = async () => {
  const filas = await prisma.gamaEsencia.findMany({ select: { id: true, nombre: true } });
  return new Map(filas.map((g) => [normalizar(g.nombre), g.id]));
};

/** Crea o actualiza insumos por nombre. NO toca existencias (eso va por conteo). */
export const importarInsumos = async (rows: any[], result: EntityImportResult) => {
  const gamas = await indiceGamas();
  for (const [i, row] of rows.entries()) {
    const fila = i + 2;
    const nombre = txt(row.nombre);
    if (!nombre) { result.omitidos++; continue; }
    const tipo = txt(row.tipo).toLowerCase();
    if (!TIPOS.includes(tipo)) {
      result.errores.push(`Fila ${fila}: tipo debe ser materia_prima, envase o accesorio`);
      result.omitidos++; continue;
    }
    const unidad = txt(row.unidad).toLowerCase() === 'ml' ? 'ml' : 'unidad';
    const alcance = txt(row.alcance).toLowerCase() === 'pedido' ? 'pedido' : 'unidad';
    const precio = num(row.costo_promedio);
    const activo = txt(row.activo).toLowerCase() !== 'no';
    const gamaCruda = txt(row.gama);
    // undefined = la columna vino vacía y no se toca lo que ya tuviera;
    // null = se pidió quitarla a propósito.
    let gamaId: number | null | undefined;
    if (gamaCruda) {
      const clave = normalizar(gamaCruda);
      if (clave === 'ninguna' || clave === '-') gamaId = null;
      else if (gamas.has(clave)) gamaId = gamas.get(clave)!;
      // Se avisa en vez de tragárselo: una gama mal escrita deja la esencia sin
      // clasificar y el costeo por gama la ignora, sin que nadie se entere.
      else result.errores.push(
        `Fila ${fila}: la gama "${gamaCruda}" no existe. Créala primero o usa una de: ${[...gamas.keys()].join(', ')}`,
      );
    }

    // Mismo criterio que la gama: vacío no toca, "ninguna" borra, y lo mal
    // escrito se avisa. Esta columna es la forma rápida de clasificar en bloque
    // las esencias que todavía no dicen para quién son.
    const generoCrudo = txt(row.genero);
    let genero: 'dama' | 'caballero' | 'unisex' | null | undefined;
    if (generoCrudo) {
      const g = normalizar(generoCrudo);
      if (g === 'ninguna' || g === 'ninguno' || g === '-') genero = null;
      else if (g === 'dama' || g === 'mujer' || g === 'femenino') genero = 'dama';
      else if (g === 'caballero' || g === 'hombre' || g === 'masculino') genero = 'caballero';
      else if (g === 'unisex') genero = 'unisex';
      else result.errores.push(
        `Fila ${fila}: el genero "${generoCrudo}" no vale. Usa dama, caballero o unisex.`,
      );
    }

    const existente = await prisma.insumoCosto.findFirst({ where: { nombre } });
    if (existente) {
      await prisma.insumoCosto.update({
        where: { id: existente.id },
        // El costo NO se pisa si viene en cero: lo manda el promedio de compras
        data: { tipo: tipo as any, unidad: unidad as any, alcance: alcance as any, activo,
          ...(precio > 0 ? { precio } : {}),
          ...(gamaId !== undefined ? { gama_id: gamaId } : {}),
          ...(genero !== undefined ? { genero } : {}) },
      });
      result.actualizados++;
    } else {
      await prisma.insumoCosto.create({
        data: { nombre, tipo: tipo as any, unidad: unidad as any, alcance: alcance as any, precio, activo,
          gama_id: gamaId ?? null, genero: genero ?? null },
      });
      result.insertados++;
    }
  }
};

/**
 * Conteo físico en bloque. Es la forma cómoda de **sembrar el stock inicial**:
 * exportas la hoja, escribes lo que hay de verdad y la vuelves a subir.
 * Reusa `ajustarStock`, así que cada fila deja su movimiento de auditoría.
 */
export const importarInventario = async (rows: any[], result: EntityImportResult) => {
  const hoy = new Date().toISOString().slice(0, 10);
  for (const [i, row] of rows.entries()) {
    const fila = i + 2;
    const nombre = txt(row.insumo);
    if (!nombre) { result.omitidos++; continue; }
    const real = num(row.cantidad_real);
    const costo = num(row.costo_unitario);

    // Se busca sin distinguir mayúsculas ni espacios de sobra: "Esencia  Khamrah"
    // y "esencia khamrah" son el mismo material, y crear un duplicado partiría
    // el stock en dos registros sin que nadie lo note.
    let insumo = await prisma.insumoCosto.findFirst({ where: { nombre } });
    if (!insumo) {
      const todos = await prisma.insumoCosto.findMany({ select: { id: true, nombre: true } });
      const clave = normalizar(nombre);
      const igual = todos.find((i) => normalizar(i.nombre) === clave);
      if (igual) insumo = await prisma.insumoCosto.findUnique({ where: { id: igual.id } });
    }

    // Si de verdad es nuevo, se CREA. Antes se rechazaba la fila, y eso obligaba
    // a dar de alta el material a mano antes de poder contarlo — justo lo que la
    // hoja venía a evitar.
    if (!insumo) {
      const tipo = txt(row.tipo).toLowerCase().replace(/\s+/g, '_');
      if (!TIPOS_VALIDOS.includes(tipo)) {
        result.errores.push(
          `Fila ${fila}: "${nombre}" es nuevo, así que necesita la columna "tipo" `
          + `(materia_prima, envase o accesorio) para poder crearlo.`);
        result.omitidos++; continue;
      }
      const unidad = txt(row.unidad).toLowerCase() === 'ml' ? 'ml' : 'unidad';
      insumo = await prisma.insumoCosto.create({
        data: {
          nombre,
          tipo: tipo as 'materia_prima' | 'envase' | 'accesorio',
          unidad,
          // El precio arranca en lo que se teclee y de ahí en adelante lo lleva
          // el costo promedio de las compras.
          precio: costo > 0 ? costo : 0,
        },
      });
      result.insertados++;
    }

    try {
      const res = await ajustarStock({
        insumo_id: insumo.id,
        cantidad_final: real,
        costo_unitario: costo > 0 ? costo : undefined,
        fecha: hoy,
        nota: 'Conteo físico importado',
      });
      if ((res as any).sinCambios) result.omitidos++;
      else result.actualizados++;
    } catch (e) {
      result.errores.push(`Fila ${fila}: ${e instanceof Error ? e.message : 'no se pudo ajustar'}`);
      result.omitidos++;
    }
  }
};
