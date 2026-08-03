import { prisma } from '../config/prisma';
import { CreateAnuncioInput } from '../schemas/anuncio.schema';
import { cacheClear, cacheGet, cacheSet } from '../utils/cache';
import { generarCodigoDescuento } from '../utils/codigoDescuento';
import { borrarImagenSiCambio, borrarImagenSubida } from '../utils/imagenes';
import { conflict, notFound } from '../utils/httpError';

const includeRel = {
  categorias: { include: { categoria: { select: { id: true, nombre: true } } } },
} as const;

const mapAnuncio = (a: any) => ({
  id: a.id,
  titulo: a.titulo,
  mensaje: a.mensaje ?? null,
  imagen_url: a.imagen_url ?? null,
  tipo: a.tipo,
  audiencia: a.audiencia,
  una_vez: a.una_vez,
  activo: a.activo,
  orden: a.orden,
  inicio: a.inicio,
  fin: a.fin,
  descuento_pct: a.descuento_pct,
  aplica_combos: a.aplica_combos,
  min_unidades: a.min_unidades ?? 0,
  min_monto: Number(a.min_monto ?? 0),
  max_descuento: Number(a.max_descuento ?? 0),
  max_canjes: a.max_canjes ?? 0,
  categoria_ids: (a.categorias ?? []).map((c: any) => c.categoria.id),
  categorias: (a.categorias ?? []).map((c: any) => c.categoria.nombre),
  // Solo en el listado admin (a.codigos ausente en el público)
  codigos_activos: (a.codigos ?? []).filter((c: any) => c.estado === 'activo').length,
  codigos_canjeados: (a.codigos ?? []).filter((c: any) => c.estado === 'canjeado').length,
});

/** Solo anuncios activos y dentro de su vigencia (para el catálogo público). */
const whereVigentes = () => {
  const hoy = new Date();
  return {
    activo: true,
    AND: [
      { OR: [{ inicio: null }, { inicio: { lte: hoy } }] },
      { OR: [{ fin: null }, { fin: { gte: hoy } }] },
    ],
  };
};

/** Excluye cupones cuya campaña ya agotó su cupo de códigos (activos+canjeados). */
const filtrarCupoDisponible = async <T extends { id: number; tipo: string; max_canjes: number }>(
  rows: T[],
): Promise<T[]> => {
  const limitados = rows.filter((a) => a.tipo === 'descuento' && a.max_canjes > 0);
  if (!limitados.length) return rows;
  const counts = await prisma.descuentoCodigo.groupBy({
    by: ['anuncio_id'],
    where: { anuncio_id: { in: limitados.map((a) => a.id) }, estado: { in: ['activo', 'canjeado'] } },
    _count: { _all: true },
  });
  const usados = new Map(counts.map((c) => [c.anuncio_id, c._count._all]));
  return rows.filter(
    (a) => a.tipo !== 'descuento' || a.max_canjes === 0 || (usados.get(a.id) ?? 0) < a.max_canjes,
  );
};

export const getAnunciosPublicos = async () => {
  const hit = cacheGet<ReturnType<typeof mapAnuncio>[]>('anuncios:public');
  if (hit) return hit;
  const rows = await prisma.anuncio.findMany({
    where: whereVigentes(),
    orderBy: { orden: 'asc' },
    include: includeRel,
  });
  // Una campaña con el cupo agotado deja de anunciarse (nadie ve promesas vencidas)
  const data = (await filtrarCupoDisponible(rows)).map(mapAnuncio);
  cacheSet('anuncios:public', data, 60_000);
  return data;
};

// ── Admin ───────────────────────────────────────────────────────────────────

export const getAnunciosAdmin = async () => {
  const rows = await prisma.anuncio.findMany({
    orderBy: [{ orden: 'asc' }, { created_at: 'desc' }],
    include: { ...includeRel, codigos: { select: { estado: true } } },
  });
  return rows.map(mapAnuncio);
};

const toData = (dto: CreateAnuncioInput) => ({
  titulo: dto.titulo,
  mensaje: dto.mensaje || null,
  imagen_url: dto.imagen_url || null,
  tipo: dto.tipo,
  audiencia: dto.audiencia,
  una_vez: dto.una_vez ?? true,
  activo: dto.activo ?? true,
  orden: dto.orden ?? 0,
  inicio: dto.inicio ? new Date(dto.inicio) : null,
  fin: dto.fin ? new Date(dto.fin) : null,
  descuento_pct: dto.tipo === 'descuento' ? (dto.descuento_pct ?? 0) : 0,
  aplica_combos: dto.tipo === 'descuento' ? (dto.aplica_combos ?? false) : false,
  min_unidades: dto.tipo === 'descuento' ? (dto.min_unidades ?? 0) : 0,
  min_monto: dto.tipo === 'descuento' ? (dto.min_monto ?? 0) : 0,
  max_descuento: dto.tipo === 'descuento' ? (dto.max_descuento ?? 0) : 0,
  max_canjes: dto.tipo === 'descuento' ? (dto.max_canjes ?? 0) : 0,
});

const validar = (dto: CreateAnuncioInput) => {
  if (dto.tipo === 'descuento') {
    if (!dto.descuento_pct || dto.descuento_pct < 1)
      throw new Error('Un anuncio de descuento necesita un porcentaje mayor a 0');
    if (!dto.aplica_combos && !dto.categoria_ids?.length)
      throw new Error('Elige a qué aplica el descuento: categorías, combos o ambos');
  }
  if (dto.tipo === 'imagen' && !dto.imagen_url)
    throw new Error('Un anuncio de imagen necesita la imagen');
};

export const createAnuncio = async (dto: CreateAnuncioInput) => {
  validar(dto);
  const row = await prisma.anuncio.create({
    data: {
      ...toData(dto),
      categorias: { create: (dto.categoria_ids ?? []).map((id) => ({ categoria_id: id })) },
    },
    include: includeRel,
  });
  cacheClear('anuncios:');
  return mapAnuncio(row);
};

export const updateAnuncio = async (id: number, dto: CreateAnuncioInput) => {
  validar(dto);
  const previo = await prisma.anuncio.findUnique({
    where: { id },
    select: { imagen_url: true },
  });
  const row = await prisma.anuncio.update({
    where: { id },
    data: {
      ...toData(dto),
      categorias: {
        deleteMany: {},
        create: (dto.categoria_ids ?? []).map((cid) => ({ categoria_id: cid })),
      },
    },
    include: includeRel,
  });
  borrarImagenSiCambio(previo?.imagen_url, dto.imagen_url);
  cacheClear('anuncios:');
  return mapAnuncio(row);
};

export const deleteAnuncio = async (id: number) => {
  const borrado = await prisma.anuncio.delete({ where: { id } });
  borrarImagenSubida(borrado.imagen_url);
  cacheClear('anuncios:');
};

// ── Cupones del usuario registrado ──────────────────────────────────────────

/**
 * El cupón que este usuario puede usar. Reglas del negocio:
 * - Una persona sostiene A LO SUMO UN cupón a la vez: con un código activo
 *   (emitido y sin canjear) no recibe otro hasta canjearlo o que se anule.
 * - Cada cupón se usa UNA sola vez en la vida (canjeado bloquea ese cupón,
 *   pero no impide recibir el cupón de una campaña distinta).
 * - De lo elegible se entrega solo el de mayor descuento, respetando el cupo
 *   de la campaña.
 */
export const getDescuentosDisponibles = async (userId: number) => {
  const activo = await prisma.descuentoCodigo.findFirst({
    where: { user_id: userId, estado: 'activo' },
  });
  if (activo) return [];
  const rows = await prisma.anuncio.findMany({
    where: {
      ...whereVigentes(),
      tipo: 'descuento',
      audiencia: { in: ['todos', 'registrados'] },
      codigos: { none: { user_id: userId, estado: { in: ['activo', 'canjeado'] } } },
    },
    orderBy: [{ descuento_pct: 'desc' }, { orden: 'asc' }],
    include: includeRel,
  });
  const disponibles = await filtrarCupoDisponible(rows);
  return disponibles.slice(0, 1).map(mapAnuncio);
};

// ── Códigos únicos de descuento ─────────────────────────────────────────────

const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase();

const crearCodigoUnico = async (anuncioId: number, userId: number | null) => {
  // Reintenta ante la remota colisión del código aleatorio (índice unique)
  for (let intento = 0; intento < 5; intento++) {
    try {
      return await prisma.descuentoCodigo.create({
        data: { codigo: generarCodigoDescuento(), anuncio_id: anuncioId, user_id: userId },
      });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
    }
  }
  throw new Error('No se pudo generar el código, intenta de nuevo');
};

const getCuponVigente = async (anuncioId: number) => {
  const anuncio = await prisma.anuncio.findFirst({
    where: { id: anuncioId, tipo: 'descuento', ...whereVigentes() },
    include: { categorias: true },
  });
  if (!anuncio) throw notFound('Este cupón ya no está vigente');
  return anuncio;
};

/** Cupo total de la campaña: códigos ya emitidos (activos o canjeados) vs. max_canjes. */
const verificarCupo = async (anuncio: { id: number; max_canjes: number }) => {
  if (!anuncio.max_canjes) return;
  const emitidos = await prisma.descuentoCodigo.count({
    where: { anuncio_id: anuncio.id, estado: { in: ['activo', 'canjeado'] } },
  });
  if (emitidos >= anuncio.max_canjes) throw conflict('Este cupón ya agotó su cupo de canjes');
};

/**
 * Emite el código único de un usuario registrado para un cupón. Reglas:
 * un solo cupón activo por persona (sea de la promo que sea), un solo uso
 * en la vida por promo, y la campaña no emite más allá de su cupo.
 */
export const emitirCodigo = async (userId: number, anuncioId: number) => {
  const anuncio = await getCuponVigente(anuncioId);
  if (anuncio.audiencia === 'no_registrados')
    throw new Error('Este cupón es solo para visitantes sin cuenta');

  const previos = await prisma.descuentoCodigo.findMany({
    where: { user_id: userId, estado: { in: ['activo', 'canjeado'] } },
  });

  const mismo = previos.find((c) => c.anuncio_id === anuncioId);
  if (mismo?.estado === 'canjeado') throw conflict('Ya usaste este cupón');
  if (mismo) return mismo; // ya tiene su código: se reenvía el mismo

  const otroActivo = previos.find((c) => c.estado === 'activo');
  if (otroActivo)
    throw conflict(`Ya tienes un cupón activo (${otroActivo.codigo}); úsalo antes de tomar otro`);

  await verificarCupo(anuncio);
  return crearCodigoUnico(anuncioId, userId);
};

/** Emite un código para un visitante sin cuenta (el navegador evita repetir). */
export const emitirCodigoAnonimo = async (anuncioId: number) => {
  const anuncio = await getCuponVigente(anuncioId);
  if (anuncio.audiencia === 'registrados')
    throw new Error('Este cupón es solo para cuentas registradas');
  await verificarCupo(anuncio);
  return crearCodigoUnico(anuncioId, null);
};

/** Certificación del admin: ¿el código es real y se puede aceptar? */
export const validarCodigo = async (codigoStr: string) => {
  const codigo = normalizarCodigo(codigoStr);
  const row = await prisma.descuentoCodigo.findUnique({
    where: { codigo },
    include: {
      anuncio: { include: { categorias: { include: { categoria: { select: { nombre: true } } } } } },
      user: { select: { nombre: true, apellido: true, email: true } },
      venta: { select: { id: true, persona: true, dia: true } },
    },
  });
  if (!row) return { valido: false, codigo, motivo: 'El código no existe: no fue emitido por la página' };
  return {
    valido: row.estado === 'activo',
    codigo: row.codigo,
    estado: row.estado,
    motivo:
      row.estado === 'activo' ? 'Código auténtico, listo para canjear'
      : row.estado === 'canjeado' ? 'Ya fue canjeado en una venta pagada'
      : 'Fue anulado por el administrador',
    cupon: {
      id: row.anuncio.id,
      titulo: row.anuncio.titulo,
      descuento_pct: row.anuncio.descuento_pct,
      aplica_combos: row.anuncio.aplica_combos,
      categorias: row.anuncio.categorias.map((c) => c.categoria.nombre),
      min_unidades: row.anuncio.min_unidades,
      min_monto: Number(row.anuncio.min_monto),
      max_descuento: Number(row.anuncio.max_descuento ?? 0),
    },
    persona: row.user ? `${row.user.nombre} ${row.user.apellido}` : 'Visitante sin cuenta',
    emitido: row.created_at,
    venta: row.venta ? { id: row.venta.id, persona: row.venta.persona, dia: row.venta.dia } : null,
  };
};

/** Anular o reactivar un código manualmente (no aplica a canjeados en venta). */
export const setEstadoCodigo = async (codigoStr: string, estado: 'activo' | 'anulado') => {
  const codigo = normalizarCodigo(codigoStr);
  const row = await prisma.descuentoCodigo.findUnique({ where: { codigo } });
  if (!row) throw notFound('El código no existe');
  if (row.estado === 'canjeado' && row.venta_id)
    throw conflict('Este código ya se canjeó en una venta; edita o elimina la venta para liberarlo');
  await prisma.descuentoCodigo.update({
    where: { id: row.id },
    data: { estado, ...(estado === 'activo' ? { canjeado_at: null } : {}) },
  });
};

// ── Canje desde el módulo de ventas ─────────────────────────────────────────

/** Valida que un código pueda enlazarse a una venta (antes de guardarla). */
export const validarCodigoParaVenta = async (codigoStr: string, ventaId: number | null) => {
  const codigo = normalizarCodigo(codigoStr);
  const row = await prisma.descuentoCodigo.findUnique({ where: { codigo } });
  if (!row) throw notFound(`El código ${codigo} no existe`);
  if (row.venta_id && row.venta_id !== ventaId)
    throw conflict(`El código ${codigo} ya está usado en otra venta`);
  if (row.estado === 'anulado') throw conflict(`El código ${codigo} fue anulado`);
  if (row.estado === 'canjeado' && row.venta_id !== ventaId)
    throw conflict(`El código ${codigo} ya fue canjeado`);
  return row;
};

/** Enlaza el código a la venta; si la venta está pagada lo canjea de una vez. */
export const aplicarCodigoAVenta = async (codigoStr: string, ventaId: number, pagada: boolean) => {
  const row = await validarCodigoParaVenta(codigoStr, ventaId);
  await prisma.descuentoCodigo.update({
    where: { id: row.id },
    data: {
      venta_id: ventaId,
      estado: pagada ? 'canjeado' : 'activo',
      canjeado_at: pagada ? new Date() : null,
    },
  });
};

/** Datos del cupón para calcular su descuento sobre un monto (créditos). */
export const getCuponParaCredito = async (codigoStr: string) => {
  const row = await validarCodigoParaVenta(codigoStr, null);
  const anuncio = await prisma.anuncio.findUnique({
    where: { id: row.anuncio_id },
    select: { descuento_pct: true, max_descuento: true },
  });
  return {
    codigoId: row.id,
    descuento_pct: anuncio?.descuento_pct ?? 0,
    max_descuento: Number(anuncio?.max_descuento ?? 0),
  };
};

/**
 * Canje INMEDIATO de un código sobre la venta de un crédito. A diferencia de una
 * venta normal (que canjea al pagarse), un crédito con cupón consume el código
 * al instante: el cliente ya recibió el descuento, el cupón muere ahí (un solo
 * uso, irreversible salvo que se borre el crédito, que lo libera).
 */
export const canjearCodigoEnCredito = async (codigoStr: string, ventaId: number) => {
  const row = await validarCodigoParaVenta(codigoStr, ventaId);
  await prisma.descuentoCodigo.update({
    where: { id: row.id },
    data: { venta_id: ventaId, estado: 'canjeado', canjeado_at: new Date() },
  });
};

/**
 * Libera los códigos enlazados a una venta (editada sin código o eliminada):
 * vuelven a estar activos para que la persona pueda usarlos en otra compra.
 *
 * @param soloNoCanjeados true = deja quietos los ya canjeados. Se usa al EDITAR.
 * Un cupón consumido queda amarrado a su venta y solo se suelta si la venta se
 * ELIMINA. Antes se liberaba cualquiera, así que bastaba con borrar el texto del
 * campo —incluso sin querer— para revivir un cupón ya gastado.
 */
export const liberarCodigoDeVenta = async (
  ventaId: number,
  exceptoCodigo?: string | null,
  soloNoCanjeados = false,
) => {
  await prisma.descuentoCodigo.updateMany({
    where: {
      venta_id: ventaId,
      ...(exceptoCodigo ? { NOT: { codigo: normalizarCodigo(exceptoCodigo) } } : {}),
      ...(soloNoCanjeados ? { NOT: { estado: 'canjeado' } } : {}),
    },
    data: { venta_id: null, estado: 'activo', canjeado_at: null },
  });
};

/**
 * El código canjeado que tiene una venta, si lo hay. Sirve para impedir que se
 * cambie al editar: la regla vive en el servidor, no en el formulario.
 */
export const codigoCanjeadoDeVenta = async (ventaId: number) => {
  const row = await prisma.descuentoCodigo.findFirst({
    where: { venta_id: ventaId, estado: 'canjeado' },
    select: { codigo: true },
  });
  return row?.codigo ?? null;
};
