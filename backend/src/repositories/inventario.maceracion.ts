import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { hoyEnColombia } from '../utils/fechas';
import { aplicarMovimiento, revertirMovimientos } from './inventario.repository';
import { registrarProduccion } from './inventario.producciones';
import { revertirTerminado } from './inventario.terminado';
import { idsDeMaterialesGenerales } from './materialesGenerales';
import { costoDelFrasco, costoPorMl, escalarReceta, saldoDeTanda } from './maceracion.calculo';

/**
 * MACERAR: la primera mitad de producir.
 *
 * Hasta hoy el sistema creía que producir era UN acto —descontar esencia y un
 * envase por unidad, y dar por armados N frascos—. En perfumería son dos
 * momentos separados por semanas, y el dueño ya trabajaba así: su lote del 11 de
 * agosto eran ~500 ml reposando en un frasco de un litro, no 5 frascos de 100 ml,
 * y los 5 envases seguían vacíos en la repisa. Textual suyo: *"hice una cosa
 * rara"* — y no la hizo: hizo lo único que el sistema le dejaba.
 *
 * Aquí vive la mitad nueva: poner a macerar, envasar de una tanda, cerrarla y
 * convertir un lote viejo. Armar directo **no se toca** y sigue viviendo en
 * `inventario.producciones.ts`.
 *
 * Reglas que gobiernan este archivo (decididas con el dueño el 2026-08-24):
 *
 * 1. En el frasco va TODO mezclado desde el primer día, así que **el granel se
 *    costea al mezclar** y envasar solo añade el envase y los accesorios.
 * 2. **Cada tanda va por separado.** Con diez graneles en curso, lo que importa
 *    es cuál lleva más tiempo reposando; un saldo único promediado lo borra.
 * 3. **El saldo no se guarda**: se recalcula. Así, corregir un envasado viejo
 *    corrige el saldo solo en vez de dejarlo mintiendo.
 *
 * Diseño completo en `docs/superpowers/specs/2026-08-24-maceracion-y-envasado-design.md`.
 */

const num = (v: unknown) => Number(v);

/** Fecha de CALENDARIO: la columna es `@db.Date` y cortarla evita correr el día. */
const dia = (f: Date) => f.toISOString().slice(0, 10);

// ── Poner a macerar ─────────────────────────────────────────────────────────

export interface MaceracionInput {
  fecha: string;
  perfume_id: number;
  /** De qué receta se toma la proporción. Se escala a los ml de la tanda. */
  formula_volumen_id: number;
  ml: number;
  listo_estimado?: string | null;
  nota?: string | null;
}

/**
 * Qué se va a gastar y cuánto cuesta, SIN escribir nada.
 *
 * La pantalla lo enseña antes de confirmar —"se descontará esencia 250 ml,
 * diluyente 244,5…"— porque poner a macerar saca de la bodega el material más
 * caro que hay, y a ciegas es donde se equivoca cualquiera.
 */
export const vistaPreviaMaceracion = async (formulaVolumenId: number, perfumeId: number, ml: number) => {
  if (!(ml > 0)) throw badRequest('Dinos cuántos ml vas a preparar (un número mayor que cero)');

  const [formula, perfume, generales] = await Promise.all([
    prisma.formulaVolumen.findUnique({ where: { id: formulaVolumenId } }),
    prisma.perfume.findUnique({
      where: { id: perfumeId },
      select: { nombre: true, insumo_esencia_id: true },
    }),
    idsDeMaterialesGenerales(),
  ]);
  if (!formula) throw badRequest('Esa proporción ya no existe');
  if (!perfume) throw badRequest('Esa fragancia ya no existe');
  if (!perfume.insumo_esencia_id) {
    throw badRequest(
      `"${perfume.nombre}" todavía no tiene esencia asignada, así que no se sabe qué descontar.`
      + ' Asígnasela en su ficha y vuelve.',
    );
  }

  const reparto = escalarReceta({
    ml_total: num(formula.ml_total),
    esencia_ml: num(formula.esencia_ml),
    sellador_ml: num(formula.sellador_ml),
    feromonas_ml: num(formula.feromonas_ml),
  }, ml);

  /** Cada material con lo que se lleva; los que el dueño no tiene cargados no salen. */
  const consumos = [
    { insumo_id: perfume.insumo_esencia_id, cantidad: reparto.esencia },
    { insumo_id: generales.diluyente, cantidad: reparto.diluyente },
    { insumo_id: generales.sellador, cantidad: reparto.sellador },
    { insumo_id: generales.feromonas, cantidad: reparto.feromonas },
  ].filter((c): c is { insumo_id: number; cantidad: number } => !!c.insumo_id && c.cantidad > 0);

  const insumos = await prisma.insumoCosto.findMany({
    where: { id: { in: consumos.map((c) => c.insumo_id) } },
    select: { id: true, nombre: true, precio: true, stock: true, unidad: true },
  });
  const porId = new Map(insumos.map((i) => [i.id, i]));

  const lineas = consumos.map((c) => {
    const i = porId.get(c.insumo_id);
    return {
      insumo_id: c.insumo_id,
      nombre: i?.nombre ?? `#${c.insumo_id}`,
      cantidad: c.cantidad,
      unidad: i?.unidad ?? 'ml',
      costo: Math.round(num(i?.precio) * c.cantidad * 100) / 100,
      /** Lo que quedaría. Negativo no bloquea: avisa (misma regla que el resto). */
      restante: Math.round((num(i?.stock) - c.cantidad) * 1000) / 1000,
    };
  });

  const costoTotal = Math.round(lineas.reduce((t, l) => t + l.costo, 0) * 100) / 100;
  return { lineas, costo_total: costoTotal, costo_ml: costoPorMl(costoTotal, ml), reparto };
};

/**
 * Pone una tanda a macerar: descuenta el líquido y congela lo que costó.
 *
 * **No gasta ni un envase**, que es justo lo que el sistema hacía mal: los
 * envases se gastan al envasar, semanas después.
 */
export const macerar = async (data: MaceracionInput) => {
  const previa = await vistaPreviaMaceracion(data.formula_volumen_id, data.perfume_id, data.ml);
  const fecha = new Date(data.fecha);

  return prisma.$transaction(async (tx) => {
    const tanda = await tx.maceracion.create({
      data: {
        fecha,
        perfume_id: data.perfume_id,
        formula_volumen_id: data.formula_volumen_id,
        ml_iniciales: data.ml,
        costo_ml: 0,
        costo_total: 0,
        listo_estimado: data.listo_estimado ? new Date(data.listo_estimado) : null,
        nota: data.nota ?? null,
      },
    });

    /**
     * El costo se congela con el promedio VIGENTE de cada material, no con el
     * de la vista previa: entre que se pintó la pantalla y se confirmó pudo
     * entrar una compra. Misma regla que los lotes y las ventas.
     */
    let costoTotal = 0;
    for (const l of previa.lineas) {
      const res = await aplicarMovimiento(tx, {
        insumo_id: l.insumo_id,
        tipo: 'maceracion',
        cantidad: -Math.abs(l.cantidad),
        fecha,
        referencia_id: tanda.id,
        nota: `Maceración #${tanda.id} · ${data.ml} ml`,
      });
      costoTotal += res.costoAplicado * l.cantidad;
    }

    const total = Math.round(costoTotal * 100) / 100;
    return tx.maceracion.update({
      where: { id: tanda.id },
      data: { costo_total: total, costo_ml: costoPorMl(total, data.ml) },
      include: { perfume: { select: { nombre: true } } },
    });
  });
};

// ── Listar lo que está macerando ────────────────────────────────────────────

/**
 * Las tandas con su saldo, ya calculado.
 *
 * `abiertas` = las que el dueño ve arriba en Producciones. Las cerradas siguen
 * consultables porque su merma cuenta en el reporte del mes.
 */
export const listarMaceraciones = async (opciones: { incluirCerradas?: boolean } = {}) => {
  const filas = await prisma.maceracion.findMany({
    where: opciones.incluirCerradas ? undefined : { cerrada_en: null },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    include: {
      perfume: { select: { id: true, nombre: true } },
      formula: { select: { nombre: true } },
      envasados: {
        select: { id: true, cantidad: true, formula_volumen_id: true, fecha: true },
      },
    },
  });

  // Los ml de cada talla envasada salen de su receta, de una sola consulta.
  const formulaIds = [...new Set(filas.flatMap((m) => m.envasados.map((e) => e.formula_volumen_id)))];
  const mlPorFormula = new Map(
    (await prisma.formulaVolumen.findMany({
      where: { id: { in: formulaIds } }, select: { id: true, ml_total: true },
    })).map((f) => [f.id, num(f.ml_total)]),
  );

  const hoy = hoyEnColombia();

  return filas.map((m) => {
    const envasados = m.envasados.map((e) => ({
      cantidad: e.cantidad, ml: mlPorFormula.get(e.formula_volumen_id) ?? 0,
    }));
    const saldo = saldoDeTanda(num(m.ml_iniciales), envasados, num(m.ml_merma ?? 0));
    return {
      id: m.id,
      fecha: dia(m.fecha),
      perfume_id: m.perfume.id,
      perfume_nombre: m.perfume.nombre,
      proporcion: m.formula?.nombre ?? null,
      ml_iniciales: num(m.ml_iniciales),
      /** Lo que queda por envasar. Puede ser negativo si se envasó de más. */
      saldo_ml: saldo,
      costo_ml: num(m.costo_ml),
      costo_total: num(m.costo_total),
      /** Plata que hay hoy en ese frasco: es la métrica "Macerando". */
      valor_saldo: Math.round(saldo * num(m.costo_ml) * 100) / 100,
      listo_estimado: m.listo_estimado ? dia(m.listo_estimado) : null,
      cerrada_en: m.cerrada_en ? dia(m.cerrada_en) : null,
      ml_merma: m.ml_merma == null ? null : num(m.ml_merma),
      /** Días reposando: es el dato por el que el dueño elige de cuál envasar. */
      dias: Math.max(0, Math.round((hoy.getTime() - m.fecha.getTime()) / 86_400_000)),
      envasados: m.envasados.length,
      nota: m.nota,
    };
  });
};

export type TandaListada = Awaited<ReturnType<typeof listarMaceraciones>>[number];

/** El saldo de UNA tanda, para validar antes de envasar. */
const saldoDe = async (maceracionId: number) => {
  const [tanda] = await listarMaceraciones({ incluirCerradas: true })
    .then((t) => t.filter((x) => x.id === maceracionId));
  return tanda ?? null;
};

// ── Envasar ─────────────────────────────────────────────────────────────────

export interface EnvasadoInput {
  maceracion_id: number;
  fecha: string;
  /** Talla que se envasa: de su receta salen los ml que se sacan del granel. */
  formula_volumen_id: number;
  cantidad: number;
  perfume_id: number;
  envase_insumo_id?: number | null;
  nota?: string | null;
}

/**
 * Envasa frascos de una tanda: gasta envases y accesorios, **no esencia**.
 *
 * El costo de cada frasco = ml de la talla × costo del ml + envase + accesorios.
 * Esa suma tiene que dar **lo mismo que armar directo**; hay una prueba de
 * aritmética que lo fija con los números reales del lote del 11 de agosto.
 *
 * Si los ml no alcanzan **avisa y deja pasar**, igual que hoy con los insumos:
 * bloquear a alguien un martes por la noche porque midió a ojo es peor que un
 * saldo negativo a la vista.
 */
export const envasar = async (data: EnvasadoInput) => {
  if (!(data.cantidad > 0)) throw badRequest('Dinos cuántos frascos envasaste');

  const tanda = await saldoDe(data.maceracion_id);
  if (!tanda) throw badRequest('Esa tanda ya no existe');
  if (tanda.cerrada_en) throw badRequest('Esa tanda está cerrada: ya no se puede envasar de ella');

  const formula = await prisma.formulaVolumen.findUnique({
    where: { id: data.formula_volumen_id },
    include: { accesorios: true },
  });
  if (!formula) throw badRequest('Ese tamaño ya no existe');

  const mlQueSalen = num(formula.ml_total) * data.cantidad;

  /**
   * Lo que gasta un envasado: el envase de ESTA vez y los accesorios de la
   * receta. Se descubrió midiendo el lote real que los accesorios (bolsa
   * organza, perfumero) son $11.400 de los $37.000 del envasado: dejarlos fuera
   * es la diferencia entre devolver bien o mal el inventario.
   *
   * Lo demás —crear el lote, congelar el costo y sumar los frascos armados— lo
   * hace `registrarProduccion`, que es el ÚNICO sitio donde se aplica un lote.
   * Copiarlo aquí habría dado dos versiones de la misma regla, y la de envasar
   * se habría quedado atrás la próxima vez que se toque la otra.
   */
  const envaseId = data.envase_insumo_id ?? formula.envase_insumo_id;
  const lote = await registrarProduccion({
    fecha: data.fecha,
    formula_volumen_id: data.formula_volumen_id,
    cantidad: data.cantidad,
    perfume_id: data.perfume_id,
    envase_insumo_id: envaseId,
    maceracion_id: data.maceracion_id,
    nota: data.nota ?? null,
    consumos: [
      ...(envaseId ? [{ insumo_id: envaseId, cantidad: data.cantidad }] : []),
      ...formula.accesorios.map((a) => ({ insumo_id: a.insumo_id, cantidad: data.cantidad })),
    ],
  });

  const despues = await saldoDe(data.maceracion_id);
  return {
    lote,
    saldo_ml: despues?.saldo_ml ?? 0,
    /**
     * Se envasó más de lo que había: **no bloquea, avisa**. Bloquear a alguien
     * un martes por la noche porque midió a ojo es peor que un saldo negativo a
     * la vista (misma regla que los insumos que no alcanzan).
     */
    aviso: mlQueSalen > tanda.saldo_ml
      ? `Envasaste ${mlQueSalen} ml de una tanda que tenía ${tanda.saldo_ml}:`
        + ' el saldo quedó en negativo. Revisa la cantidad o cierra la tanda.'
      : null,
  };
};

// ── Cerrar y borrar ─────────────────────────────────────────────────────────

/**
 * Cierra la tanda: lo que quedaba en el frasco se anota como merma.
 *
 * **No genera movimiento de inventario**: el granel no es un insumo y no hay a
 * quién restarle. Sale en el reporte como merma de maceración.
 */
export const cerrarMaceracion = async (id: number, fecha?: string) => {
  const tanda = await saldoDe(id);
  if (!tanda) throw badRequest('Esa tanda ya no existe');
  if (tanda.cerrada_en) throw badRequest('Esa tanda ya estaba cerrada');

  return prisma.maceracion.update({
    where: { id },
    data: {
      cerrada_en: fecha ? new Date(fecha) : hoyEnColombia(),
      ml_merma: Math.max(0, tanda.saldo_ml),
    },
    include: { perfume: { select: { nombre: true } } },
  });
};

/**
 * Borra una tanda y devuelve su líquido a la bodega.
 *
 * **Solo si no se ha envasado nada de ella.** Es el arreglo de fondo del susto
 * viejo: borrar el lote del 212 devolvería una esencia que SÍ se gastó —está en
 * el frasco de un litro—. Con envasados de por medio, primero se borran esos.
 */
export const eliminarMaceracion = (id: number) => prisma.$transaction(async (tx) => {
  const envasados = await tx.produccion.count({ where: { maceracion_id: id } });
  if (envasados > 0) {
    throw badRequest(
      `No se puede borrar: de esta tanda ya salieron ${envasados} `
      + `${envasados === 1 ? 'envasado' : 'envasados'}. Bórralos primero y vuelve.`,
    );
  }
  await revertirMovimientos(tx, 'maceracion', id);
  return tx.maceracion.delete({ where: { id } });
});

// ── Convertir un lote viejo ─────────────────────────────────────────────────

/**
 * "Esto en realidad está macerando": convierte un lote de armado directo en una
 * tanda.
 *
 * Es el caso del 212 VIP Black del 11 de agosto: el sistema cree que son 5
 * frascos de 100 ml y en la repisa hay ~500 ml reposando en un frasco de un
 * litro, con sus 5 envases todavía vacíos al lado.
 *
 * Lo delicado es **qué se devuelve y qué no**:
 *
 * - **Los envases y los accesorios SÍ vuelven** a la bodega: nunca se usaron. En
 *   el lote real son 5 envases, 5 bolsas organza y 5 perfumeros — y esos 5
 *   perfumeros son parte del agujero que tiene ese material en negativo.
 * - **La esencia y el diluyente NO vuelven**: están dentro del frasco. Sus
 *   movimientos no se borran, se **re-etiquetan** a la tanda nueva; así el stock
 *   no se mueve ni un ml y, si algún día se borra la tanda, se devuelven bien.
 * - **Los frascos que el sistema creía tener se quitan**, porque no existen.
 *
 * El costo de la tanda es el **original del lote**, no el promedio de hoy: ese
 * material se pagó en agosto.
 */
export const convertirLoteEnMaceracion = (loteId: number) => prisma.$transaction(async (tx) => {
  const lote = await tx.produccion.findUnique({
    where: { id: loteId },
    include: { formula: { select: { ml_total: true } } },
  });
  if (!lote) throw badRequest('Ese lote ya no existe');
  if (lote.maceracion_id) throw badRequest('Ese lote ya salió de una maceración');
  if (!lote.perfume_id) {
    throw badRequest('Ese lote no dice qué fragancia se armó, así que no se sabe qué se está macerando');
  }

  /**
   * Si ya se vendió algún frasco no hay nada que convertir sin descuadrar el
   * terminado: esos frascos existieron de verdad. Se comprueba contra lo que
   * ese lote metió, no contra el stock total, porque la ficha puede tener
   * frascos de otros lotes.
   */
  const armados = await tx.movimientoTerminado.findMany({
    where: { tipo: 'produccion', referencia_id: loteId },
    select: { perfume_id: true, presentacion_id: true, cantidad: true },
  });
  for (const a of armados) {
    const ficha = await tx.perfumePresentacion.findUnique({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: a.perfume_id, presentacion_id: a.presentacion_id,
        },
      },
      select: { stock: true },
    });
    if (num(ficha?.stock) < num(a.cantidad)) {
      throw badRequest(
        'Ya vendiste frascos de este lote, así que no se puede convertir en maceración:'
        + ' esos frascos existieron de verdad.',
      );
    }
  }

  const ml = num(lote.formula?.ml_total ?? 0) * lote.cantidad;
  if (!(ml > 0)) throw badRequest('Ese lote no tiene un tamaño con ml, así que no se sabe cuánto granel es');

  // Qué se devuelve y qué se queda: lo decide el TIPO del material.
  const movs = await tx.movimientoInventario.findMany({
    where: { tipo: 'produccion', referencia_id: loteId },
    select: {
      id: true, insumo_id: true, cantidad: true, costo_unitario: true,
      insumo: { select: { tipo: true } },
    },
  });
  const vuelven = movs.filter((m) => m.insumo.tipo !== 'materia_prima');
  const liquidos = movs.filter((m) => m.insumo.tipo === 'materia_prima');

  /**
   * **La tanda vale solo el líquido**, no lo que costó el lote entero.
   *
   * Los envases y los accesorios vuelven a la repisa, así que su plata sale del
   * granel: dejarla dentro valoraría 500 ml con $25.000 de frascos que están
   * vacíos en la estantería, y al envasarlos de verdad se pagarían **dos veces**.
   * Lo cazó una prueba, no una revisión a ojo.
   */
  const costoQueVuelve = vuelven.reduce(
    (t, m) => t + Math.abs(num(m.cantidad)) * num(m.costo_unitario), 0,
  );
  const costoTotal = Math.round((num(lote.costo_total) - costoQueVuelve) * 100) / 100;

  const tanda = await tx.maceracion.create({
    data: {
      fecha: lote.fecha,
      perfume_id: lote.perfume_id,
      formula_volumen_id: lote.formula_volumen_id,
      ml_iniciales: ml,
      costo_total: costoTotal,
      costo_ml: costoPorMl(costoTotal, ml),
      nota: `Convertido del lote #${loteId}`,
    },
  });

  const devolver = vuelven.map((m) => m.insumo_id);

  if (devolver.length) await revertirMovimientos(tx, 'produccion', loteId, devolver);

  // El líquido no se devuelve: cambia de dueño. El stock no se mueve.
  if (liquidos.length) {
    await tx.movimientoInventario.updateMany({
      where: { id: { in: liquidos.map((m) => m.id) } },
      data: {
        tipo: 'maceracion',
        referencia_id: tanda.id,
        nota: `Maceración #${tanda.id} · convertida del lote #${loteId}`,
      },
    });
  }

  // Los frascos que el sistema creía tener no existen.
  await revertirTerminado(tx, 'produccion', loteId);
  await tx.produccion.delete({ where: { id: loteId } });

  return tx.maceracion.findUniqueOrThrow({
    where: { id: tanda.id }, include: { perfume: { select: { nombre: true } } },
  });
});
