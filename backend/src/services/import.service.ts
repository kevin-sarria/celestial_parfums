import * as xlsx from 'xlsx';
import { prisma } from '../config/prisma';

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
    const data = rows(wb.Sheets['Ventas'])
      .filter(r => r['Dia'] && r['Persona'])
      .map(r => ({
        dia:                 toDate(r['Dia']),
        persona:             toStr(r['Persona']),
        cantidad_perfumes:   toNum(r['Cantidad Perfumes']) || 1,
        presentacion:        toStr(r['Presentacion Perfumes']),
        referencia_perfume:  toStr(r['Referencia Perfume']),
        valor_venta:         toNum(r['Valor Venta']),
        datos_adicionales:   toNullStr(r['Datos Adicionales Venta']),
      }));

    try {
      const created = await prisma.venta.createMany({ data });
      result.ventas = created.count;
    } catch (e: any) {
      result.errores.push(`Ventas: ${e.message}`);
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
          const c = await prisma.cliente.create({
            data: {
              nombre,
              apellido,
              telefono: celular,
              correo:   toNullStr(r['Correo']),
            },
          });
          clienteCache[key] = c.id;
          result.clientes_creados++;
        }

        const ab = (n: number) => toNullNum(r[`Abono ${n}`]);

        await prisma.credito.create({
          data: {
            fecha:         toDate(r['Fecha']),
            cliente_id:    clienteCache[key],
            articulos:     toStr(r['Articulos']),
            deuda_inicial: toNum(r['Deuda Inicial']),
            abono_1:  ab(1),  abono_2:  ab(2),  abono_3:  ab(3),
            abono_4:  ab(4),  abono_5:  ab(5),  abono_6:  ab(6),
            abono_7:  ab(7),  abono_8:  ab(8),  abono_9:  ab(9),
            abono_10: ab(10),
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
