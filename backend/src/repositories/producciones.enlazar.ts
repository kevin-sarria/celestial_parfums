import { prisma } from '../config/prisma';
import { tallaDeFormula } from './inventario.terminado';

/**
 * LOTES POR ENLAZAR: los que dejaron sus frascos en el sitio equivocado, o no
 * los dejaron.
 *
 * Solo LEE. Las acciones son las que ya existen —la carga inicial y el PATCH
 * del lote—: un tercer camino para mover frascos sería una tercera versión de
 * la misma regla, y aquí una regla vive en un solo sitio.
 *
 * Ninguna de las dos reglas adivina por el NOMBRE ("dice 1.1"): bastaría un
 * "Set 1.1" o un 1.1 sin esas letras para que la lista mintiera, y una lista
 * que miente en dinero se deja de mirar. Las dos son hechos comprobables.
 */

export interface LotePorEnlazar {
  id: number;
  fecha: string;
  cantidad: number;
  formula_volumen_id: number;
  perfume_id: number | null;
  perfume_nombre: string | null;
  volumen_nombre: string;
  presentacion_id: number | null;
  costo_unitario: number;
  envase_insumo_id: number | null;
  envase_nombre: string | null;
  /** Lo que gastó, en positivo: el PATCH del lote los pide de vuelta. */
  consumos: { insumo_id: number; cantidad: number }[];
  /** `sin_frascos`: nunca entraron. `envase_ajeno`: entraron en la ficha equivocada. */
  motivo: 'sin_frascos' | 'envase_ajeno';
  ficha_sugerida: { id: number; nombre: string } | null;
}

export const lotesPorEnlazar = async (): Promise<LotePorEnlazar[]> => {
  const lotes = await prisma.produccion.findMany({
    where: { perfume_id: { not: null } },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    include: { formula: { select: { nombre: true } }, perfume: { select: { id: true, nombre: true } } },
  });

  const salida: LotePorEnlazar[] = [];

  for (const lote of lotes) {
    if (!lote.perfume) continue;
    const presentacion_id = await tallaDeFormula(lote.formula_volumen_id);
    const frascos = await prisma.movimientoTerminado.count({
      where: { tipo: 'produccion', referencia_id: lote.id },
    });

    const envase = lote.envase_insumo_id
      ? await prisma.insumoCosto.findUnique({
        where: { id: lote.envase_insumo_id }, select: { nombre: true },
      })
      : null;

    /**
     * Lo que ese lote consumió, sacado de su propio libro y en positivo.
     *
     * Viaja a la pantalla porque el PATCH del lote pide el lote ENTERO: si el
     * enlazador mandara solo la ficha nueva, la edición rehacería el lote sin
     * material y la esencia se quedaría devuelta.
     */
    const movimientos = await prisma.movimientoInventario.findMany({
      where: { tipo: 'produccion', referencia_id: lote.id },
      select: { insumo_id: true, cantidad: true },
    });
    const consumos = movimientos.map((m) => ({
      insumo_id: m.insumo_id, cantidad: Math.abs(Number(m.cantidad)),
    }));

    const comun = {
      id: lote.id,
      // Fecha de CALENDARIO: la columna es `@db.Date` y Prisma la lee a
      // medianoche UTC, así que cortar el ISO da el día correcto.
      fecha: lote.fecha.toISOString().slice(0, 10),
      cantidad: lote.cantidad,
      formula_volumen_id: lote.formula_volumen_id,
      perfume_id: lote.perfume.id,
      perfume_nombre: lote.perfume.nombre,
      volumen_nombre: lote.formula?.nombre ?? '',
      presentacion_id,
      costo_unitario: Number(lote.costo_unitario),
      envase_insumo_id: lote.envase_insumo_id,
      envase_nombre: envase?.nombre ?? null,
      consumos,
    };

    // Regla 1: descontó material y no dejó ni un frasco. Son los lotes
    // registrados antes de que existiera el libro del terminado.
    if (frascos === 0 && presentacion_id) {
      salida.push({ ...comun, motivo: 'sin_frascos', ficha_sugerida: null });
      continue;
    }

    // Regla 2: el envase que gastó no es el que declara la ficha donde quedaron
    // sus frascos. Es el caso Khamrah, y es un hecho, no una corazonada.
    if (!lote.envase_insumo_id || !presentacion_id) continue;
    const ficha = await prisma.perfumePresentacion.findUnique({
      where: {
        perfume_id_presentacion_id: { perfume_id: lote.perfume.id, presentacion_id },
      },
      select: { envase_insumo_id: true },
    });
    if (ficha?.envase_insumo_id === lote.envase_insumo_id) continue;

    // Quién SÍ declara ese envase: esa es la ficha que se propone como destino.
    const candidata = await prisma.perfumePresentacion.findFirst({
      where: {
        envase_insumo_id: lote.envase_insumo_id,
        presentacion_id,
        perfume_id: { not: lote.perfume.id },
      },
      select: { perfume: { select: { id: true, nombre: true } } },
    });

    salida.push({
      ...comun,
      motivo: 'envase_ajeno',
      ficha_sugerida: candidata?.perfume
        ? { id: candidata.perfume.id, nombre: candidata.perfume.nombre }
        : null,
    });
  }

  return salida;
};
