import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import type {
  InsumoInput, FormulaInput, EscalaInput, CotizacionConfigInput, CondicionesComerciales,
} from '../schemas/cotizacion.schema';

/**
 * Datos de costeo del módulo mayorista: insumos, fórmulas por volumen, escalas
 * de precio y la config de textos. Todo lo teclea el admin (no hay inventario
 * todavía), así que nada de esto vive quemado en el código.
 */

const num = (v: any) => Number(v);

// ── Insumos ─────────────────────────────────────────────────────────────────
const mapInsumo = (i: any) => ({
  id: i.id,
  nombre: i.nombre,
  tipo: i.tipo,
  unidad: i.unidad,
  alcance: i.alcance,
  precio: num(i.precio),
  activo: i.activo,
  /** Solo esencias; null en envases, accesorios y el resto de materias primas. */
  gama: i.gama ?? null,
});

/**
 * Los insumos con los que se trabaja.
 *
 * Por defecto SOLO los activos: los apagados no deben aparecer al registrar una
 * compra ni una producción. La pantalla que los administra pide `todos` para
 * poder volver a encenderlos.
 */
export const listarInsumos = async (todos = false) => {
  const rows = await prisma.insumoCosto.findMany({
    where: todos ? undefined : { activo: true },
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  });
  return rows.map(mapInsumo);
};

/**
 * Cuánto cuesta por ml, en promedio, cada gama de esencia.
 *
 * Es el costo con el que se cotiza cuando el cliente pide "50 de 30 ml" sin
 * decir qué fragancias. Se calcula del inventario en cada llamada —nunca se
 * guarda— por la misma razón que el cupo y la tarjeta de puntos: un promedio
 * guardado se desincroniza en cuanto entra una compra.
 *
 * Cuenta solo esencias ACTIVAS y con precio: una apagada o en cero arrastraría
 * el promedio hacia abajo y haría ver márgenes que no existen.
 */
export const promediosPorGama = async () => {
  const filas = await prisma.insumoCosto.groupBy({
    by: ['gama'],
    where: { activo: true, gama: { not: null }, precio: { gt: 0 } },
    _avg: { precio: true },
    _min: { precio: true },
    _max: { precio: true },
    _count: { _all: true },
  });
  return filas
    .filter((f) => f.gama)
    .map((f) => ({
      gama: f.gama as string,
      esencias: f._count._all,
      promedio: Math.round(num(f._avg.precio) * 100) / 100,
      minimo: num(f._min.precio),
      maximo: num(f._max.precio),
    }))
    .sort((a, b) => a.promedio - b.promedio);
};

export const crearInsumo = (data: InsumoInput) =>
  prisma.insumoCosto.create({ data: { ...data, activo: data.activo ?? true } }).then(mapInsumo);

export const actualizarInsumo = (id: number, data: InsumoInput) =>
  prisma.insumoCosto.update({ where: { id }, data }).then(mapInsumo);

/**
 * Borra un insumo, pero SOLO si no dejó rastro.
 *
 * Se comprueba antes en vez de dejar que reviente la llave foránea: el error de
 * la base dice "foreign key constraint fails", que no le sirve a nadie. Aquí se
 * dice qué lo retiene y qué hacer en su lugar — apagarlo, que lo esconde sin
 * romper el historial contable.
 */
export const eliminarInsumo = async (id: number) => {
  const [movimientos, compras, comoEnvase, comoEsencia, enAccesorios, enPerfumes, enTallas] =
    await Promise.all([
      prisma.movimientoInventario.count({ where: { insumo_id: id } }),
      prisma.compraItem.count({ where: { insumo_id: id } }),
      prisma.formulaVolumen.count({ where: { envase_insumo_id: id } }),
      prisma.formulaVolumen.count({ where: { esencia_insumo_id: id } }),
      prisma.formulaAccesorio.count({ where: { insumo_id: id } }),
      prisma.perfume.count({ where: { OR: [{ insumo_esencia_id: id }, { insumo_producto_id: id }] } }),
      prisma.perfumePresentacion.count({ where: { envase_insumo_id: id } }),
    ]);

  const motivos: string[] = [];
  if (movimientos > 0) motivos.push(`tiene ${movimientos} movimiento(s) de inventario`);
  if (compras > 0) motivos.push(`aparece en ${compras} compra(s)`);
  if (comoEnvase + comoEsencia + enAccesorios > 0) motivos.push('lo usa la receta de algún tamaño');
  if (enPerfumes > 0) motivos.push(`${enPerfumes} perfume(s) lo tienen asignado`);
  if (enTallas > 0) motivos.push('es el envase de alguna talla');

  if (motivos.length > 0) {
    throw badRequest(
      `No se puede borrar: ${motivos.join(', ')}. `
      + 'Borrarlo dejaría esos registros sin referencia y descuadraría tu historial. '
      + 'Apágalo con el interruptor "Activo": deja de aparecer al comprar y producir, y su pasado queda intacto.',
    );
  }
  return prisma.insumoCosto.delete({ where: { id } });
};

// ── Fórmulas por volumen ────────────────────────────────────────────────────
const mapFormula = (f: any) => {
  const esencia = num(f.esencia_ml);
  const sellador = num(f.sellador_ml);
  const feromonas = num(f.feromonas_ml);
  return {
    id: f.id,
    nombre: f.nombre,
    ml_total: f.ml_total,
    esencia_ml: esencia,
    sellador_ml: sellador,
    feromonas_ml: feromonas,
    /// El diluyente es SIEMPRE el resto: nunca se guarda, así no se desincroniza.
    diluyente_ml: Math.max(0, Math.round((f.ml_total - esencia - sellador - feromonas) * 100) / 100),
    envase_insumo_id: f.envase_insumo_id,
    envase_nombre: f.envase?.nombre ?? null,
    envase_precio: f.envase ? num(f.envase.precio) : null,
    // Esencia elegida para ESTA receta (evita adivinar cuando hay varias)
    esencia_insumo_id: f.esencia_insumo_id ?? null,
    esencia_nombre: f.esencia?.nombre ?? null,
    esencia_precio: f.esencia ? num(f.esencia.precio) : null,
    activo: f.activo,
    orden: f.orden,
    escalas: (f.escalas ?? []).map(mapEscala),
    // Accesorios que este tamaño incluye por defecto (punto de partida al cotizar)
    accesorios_default: (f.accesorios ?? []).map((a: any) => ({
      insumo_id: a.insumo_id, nombre: a.insumo?.nombre ?? '', precio: num(a.insumo?.precio ?? 0),
    })),
  };
};

export const listarFormulas = async () => {
  const rows = await prisma.formulaVolumen.findMany({
    orderBy: [{ orden: 'asc' }, { ml_total: 'asc' }],
    include: { envase: true, esencia: true, accesorios: { include: { insumo: true } }, escalas: { orderBy: { cantidad_min: 'asc' } } },
  });
  return rows.map(mapFormula);
};

export const crearFormula = async (data: FormulaInput) => {
  const row = await prisma.formulaVolumen.create({
    data: { ...data, activo: data.activo ?? true, orden: data.orden ?? 0 },
    include: { envase: true, esencia: true, accesorios: { include: { insumo: true } }, escalas: true },
  });
  return mapFormula(row);
};

export const actualizarFormula = async (id: number, data: FormulaInput) => {
  const row = await prisma.formulaVolumen.update({
    where: { id }, data,
    include: { envase: true, esencia: true, accesorios: { include: { insumo: true } }, escalas: { orderBy: { cantidad_min: 'asc' } } },
  });
  return mapFormula(row);
};

export const eliminarFormula = (id: number) => prisma.formulaVolumen.delete({ where: { id } });

/** Reemplaza los accesorios que un tamaño incluye por defecto. */
export const setAccesoriosFormula = async (formulaId: number, insumoIds: number[]) => {
  await prisma.$transaction([
    prisma.formulaAccesorio.deleteMany({ where: { formula_volumen_id: formulaId } }),
    prisma.formulaAccesorio.createMany({
      data: insumoIds.map((id) => ({ formula_volumen_id: formulaId, insumo_id: id })),
      skipDuplicates: true,
    }),
  ]);
  const row = await prisma.formulaVolumen.findUnique({
    where: { id: formulaId },
    include: { envase: true, esencia: true, accesorios: { include: { insumo: true } }, escalas: { orderBy: { cantidad_min: 'asc' } } },
  });
  return row ? mapFormula(row) : null;
};

// ── Escalas de precio ───────────────────────────────────────────────────────
const mapEscala = (e: any) => ({
  id: e.id,
  formula_volumen_id: e.formula_volumen_id,
  cantidad_min: e.cantidad_min,
  cantidad_max: e.cantidad_max,
  precio: num(e.precio),
});

export const crearEscala = (data: EscalaInput) => prisma.escalaPrecio.create({ data }).then(mapEscala);

export const actualizarEscala = (id: number, data: EscalaInput) =>
  prisma.escalaPrecio.update({ where: { id }, data }).then(mapEscala);

export const eliminarEscala = (id: number) => prisma.escalaPrecio.delete({ where: { id } });

// ── Config (fila única, patrón SobreNosotrosConfig) ─────────────────────────
/**
 * Textos por defecto. Son los que Kevin escribió al pedir el módulo: quedan como
 * semilla editable, no como texto quemado — desde la UI se cambian todos.
 */
const CONDICIONES_DEFAULT: CondicionesComerciales = {
  pedido_minimo: '',
  tiempo_preparacion: '',
  tiempo_despacho: '',
  forma_pago: '',
  condiciones_pago: '',
  costos_envio: '',
  garantias: '',
  politica_cambios: '',
};

const BENEFICIOS_DEFAULT = [
  'Alta concentración aromática.',
  'Excelente fijación.',
  'Perfumes listos para la venta.',
  'Presentación premium.',
  'Amplio catálogo de referencias.',
  'Asesoría personalizada.',
  'Posibilidad de reposición de inventario.',
  'Producto pensado para generar una excelente experiencia al cliente final.',
];

const AVISOS_DEFAULT = [
  'La presente cotización tiene una vigencia de {{vigencia}} días calendario a partir de su fecha de emisión.',
  'Los precios están sujetos a cambios sin previo aviso una vez vencida la vigencia de esta cotización.',
  'La disponibilidad de referencias está sujeta al inventario de materias primas y envases al momento de confirmar el pedido.',
  'La producción iniciará una vez se confirme el pedido y se cumplan las condiciones de pago acordadas.',
  'Las imágenes utilizadas son ilustrativas y pueden presentar ligeras variaciones respecto al producto final.',
  'Los tiempos de entrega son estimados y pueden variar por disponibilidad de insumos, transportadoras o causas ajenas a Celestial Parfums.',
  'Celestial Parfums se reserva el derecho de actualizar precios, presentaciones o condiciones comerciales cuando existan variaciones significativas en los costos de producción.',
  'La aceptación de esta cotización implica la aceptación de las condiciones comerciales aquí descritas.',
];

const mapConfig = (c: any) => ({
  vigencia_dias_default: c.vigencia_dias_default,
  condiciones_comerciales: { ...CONDICIONES_DEFAULT, ...(c.condiciones_comerciales ?? {}) },
  beneficios_items: (c.beneficios_items ?? []) as string[],
  avisos_legales: (c.avisos_legales ?? []) as string[],
});

export const getConfig = async () => {
  const existente = await prisma.cotizacionConfig.findFirst({ orderBy: { id: 'asc' } });
  if (existente) return mapConfig(existente);
  const creado = await prisma.cotizacionConfig.create({
    data: {
      condiciones_comerciales: CONDICIONES_DEFAULT,
      beneficios_items: BENEFICIOS_DEFAULT,
      avisos_legales: AVISOS_DEFAULT,
    },
  });
  return mapConfig(creado);
};

export const saveConfig = async (data: CotizacionConfigInput) => {
  const existente = await prisma.cotizacionConfig.findFirst({ orderBy: { id: 'asc' } });
  const payload = {
    vigencia_dias_default: data.vigencia_dias_default,
    condiciones_comerciales: data.condiciones_comerciales,
    beneficios_items: data.beneficios_items,
    avisos_legales: data.avisos_legales,
  };
  const row = existente
    ? await prisma.cotizacionConfig.update({ where: { id: existente.id }, data: payload })
    : await prisma.cotizacionConfig.create({ data: payload });
  return mapConfig(row);
};
