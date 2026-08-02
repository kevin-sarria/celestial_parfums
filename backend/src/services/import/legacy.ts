import * as xlsx from 'xlsx';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { agruparEnlaces, buildPerfumeIndex, matchPerfumes } from '../../utils/perfumeMatcher';
import { bustImportCache, toDate, toNum, toStr, toNullStr, toNullNum, toDateOrNull, rows , loadPerfumeIndex, ensurePersona } from './core';

/**
 * Importador histórico de un Excel con VARIAS hojas a la vez (ventas, créditos,
 * proveedores). Se mantiene por compatibilidad con los archivos que el dueño ya
 * tenía; lo nuevo entra por entidad con `importEntity`.
 */

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

