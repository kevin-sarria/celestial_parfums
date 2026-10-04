import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { r4 } from '../utils/redondeo';
import { insumosDeEmpaque } from '../empaque/sinEmpaque';
import { revertirMovimientos } from './inventario.repository';
import { recalcularPromedioTerminado, tallaDeFormula } from './inventario.terminado';
import { corregirVentasDe11, revisarVentasDe11 } from './ventasDe11Costo';

type Cliente = Prisma.TransactionClient | typeof prisma;
const num = (v: unknown) => Number(v ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * LOTES QUE CARGARON ACCESORIOS QUE SU FICHA NO LLEVA.
 *
 * Hasta el 2026-09-27 un lote cobraba siempre los accesorios de la RECETA,
 * aunque la ficha dijera otra cosa (ver `accesoriosDeFicha.ts`). Medido contra
 * el respaldo del 22 de septiembre: los 27 lotes 1.1 cargaron una bolsa de
 * organza que nunca usaron — $8.100 y 27 bolsas fuera de la bodega.
 *
 * Desde el 2026-10-04 la regla quedó CONGELADA así: un lote de 1.1 nunca debió
 * llevar empaque (bolsa, perfumero); los lotes de los demás lo cargaban por
 * receta y eso fue verdad en su día, así que se respetan. Ya ningún lote nuevo
 * carga empaque (`empaque/sinEmpaque.ts`): esto solo limpia lo de antes.
 *
 * Se recalcula en cada consulta (nada se guarda): mientras quede algo que
 * corregir, Producciones enseña el aviso; corregido, desaparece solo.
 *
 * Corregir un lote = devolver esos accesorios al inventario y bajarle su costo
 * al lote y a sus frascos. Desde el 2026-09-29 (decisión del dueño, opción B)
 * el mismo botón corrige también las VENTAS que ya salieron de esos frascos
 * (`ventasDe11Costo.ts`): antes conservaban el costo viejo y la ganancia de
 * esos meses salía más baja de lo real. En producción los lotes ya se habían
 * corregido el 28-sep, así que allá el aviso vuelve a salir solo por las ventas.
 */

interface Sobrante {
  lote_id: number;
  fecha: Date;
  ficha: string | null;
  cantidad: number;
  insumos: { insumo_id: number; nombre: string; unidades: number; valor: number }[];
  valor: number;
}

export const revisarAccesoriosSobrantes = async (cli: Cliente = prisma) => {
  const [lotes, empaque] = await Promise.all([
    cli.produccion.findMany({
      where: { perfume: { solo_armado: true } },
      select: { id: true, fecha: true, cantidad: true, perfume: { select: { nombre: true } } },
      orderBy: { fecha: 'asc' },
    }),
    insumosDeEmpaque(cli),
  ]);
  const sobran = [...empaque];

  const sobrantes: Sobrante[] = [];
  if (sobran.length === 0) return { lotes: sobrantes, valor: 0, unidades: 0, ventas: await revisarVentasDe11(cli) };
  for (const l of lotes) {

    const movs = await cli.movimientoInventario.findMany({
      where: { tipo: 'produccion', referencia_id: l.id, insumo_id: { in: sobran } },
      select: { insumo_id: true, cantidad: true, costo_unitario: true, insumo: { select: { nombre: true } } },
    });
    if (movs.length === 0) continue;

    const insumos = movs.map((m) => ({
      insumo_id: m.insumo_id,
      nombre: m.insumo.nombre,
      unidades: Math.abs(num(m.cantidad)),
      valor: r2(Math.abs(num(m.cantidad)) * num(m.costo_unitario)),
    }));
    sobrantes.push({
      lote_id: l.id, fecha: l.fecha, ficha: l.perfume?.nombre ?? null, cantidad: l.cantidad,
      insumos, valor: r2(insumos.reduce((s, i) => s + i.valor, 0)),
    });
  }

  return {
    lotes: sobrantes,
    valor: r2(sobrantes.reduce((s, l) => s + l.valor, 0)),
    unidades: sobrantes.reduce((s, l) => s + l.insumos.reduce((t, i) => t + i.unidades, 0), 0),
    // Solo las que se ven YA: con lotes sin corregir, sus ventas aparecen
    // después de corregirlos (el promedio del libro todavía trae el sobrecosto).
    ventas: await revisarVentasDe11(cli),
  };
};

/** Aplica la corrección a TODOS los lotes pendientes, en una sola transacción. */
export const quitarAccesoriosSobrantes = () => prisma.$transaction(async (tx) => {
  const revision = await revisarAccesoriosSobrantes(tx);

  for (const s of revision.lotes) {
    await revertirMovimientos(tx, 'produccion', s.lote_id, s.insumos.map((i) => i.insumo_id));

    const lote = await tx.produccion.findUniqueOrThrow({ where: { id: s.lote_id } });
    // Un costo escrito a mano manda: el dueño lo fijó y no se toca.
    if (lote.costo_manual) continue;

    const total = r2(num(lote.costo_total) - s.valor);
    const unitario = r4(total / lote.cantidad);
    await tx.produccion.update({ where: { id: lote.id }, data: { costo_total: total, costo_unitario: unitario } });

    // Los frascos que entraron con este lote valen lo mismo que el lote.
    await tx.movimientoTerminado.updateMany({
      where: { tipo: 'produccion', referencia_id: lote.id },
      data: { costo_unitario: unitario },
    });
    const presentacion_id = await tallaDeFormula(lote.formula_volumen_id);
    if (lote.perfume_id && presentacion_id) {
      await recalcularPromedioTerminado(tx, lote.perfume_id, presentacion_id);
    }
  }

  // DESPUÉS de los lotes: el costo real de cada frasco vendido sale del libro ya corregido
  const ventas = await corregirVentasDe11(tx);
  return { lotes: revision.lotes.length, valor: revision.valor, unidades: revision.unidades, ...ventas };
}, { timeout: 60_000 });
