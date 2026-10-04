import type { LineaEmpaque } from '@prisma/client';
import type { LineaProducto } from '../repositories/perfume.mapeo';

/**
 * La línea con la que se busca el empaque de una unidad vendida.
 *
 * Sale de la línea del producto (`lineaDe`, que ya decide contratipo / 1.1 /
 * original / producto) más una sola pregunta: si un original sale en su
 * botella entera o en decant, porque se entregan distinto. Un accesorio no
 * lleva empaque: ÉL es el empaque.
 */
export const lineaEmpaqueDe = (linea: LineaProducto, botellaCompleta: boolean): LineaEmpaque | null => {
  switch (linea) {
    case 'contratipo': return 'contratipo';
    case '1.1': return 'uno_uno';
    case 'original': return botellaCompleta ? 'botella_completa' : 'decant';
    case 'producto': return 'producto';
    default: return null;
  }
};
