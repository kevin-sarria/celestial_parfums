import { prisma } from '../config/prisma';
import { CreateAnuncioInput } from '../schemas/anuncio.schema';
import { cacheClear, cacheGet, cacheSet } from '../utils/cache';
import { generarCodigoDescuento } from '../utils/codigoDescuento';
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

export const getAnunciosPublicos = async () => {
  const hit = cacheGet<ReturnType<typeof mapAnuncio>[]>('anuncios:public');
  if (hit) return hit;
  const rows = await prisma.anuncio.findMany({
    where: whereVigentes(),
    orderBy: { orden: 'asc' },
    include: includeRel,
  });
  const data = rows.map(mapAnuncio);
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
  cacheClear('anuncios:');
  return mapAnuncio(row);
};

export const deleteAnuncio = async (id: number) => {
  await prisma.anuncio.delete({ where: { id } });
  cacheClear('anuncios:');
};

// ── Cupones del usuario registrado ──────────────────────────────────────────

/**
 * Cupones vigentes que este usuario todavía puede usar: sin código emitido ni
 * canjeado para ese cupón (un código anulado libera el cupón de nuevo).
 */
export const getDescuentosDisponibles = async (userId: number) => {
  const rows = await prisma.anuncio.findMany({
    where: {
      ...whereVigentes(),
      tipo: 'descuento',
      audiencia: { in: ['todos', 'registrados'] },
      codigos: { none: { user_id: userId, estado: { in: ['activo', 'canjeado'] } } },
    },
    orderBy: { orden: 'asc' },
    include: includeRel,
  });
  return rows.map(mapAnuncio);
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

/**
 * Emite el código único de un usuario registrado para un cupón. Regla del
 * negocio: máximo UN código activo por persona y por tipo de cupón (categorías
 * o combos que cubre); nunca dos códigos para el mismo cupón.
 */
export const emitirCodigo = async (userId: number, anuncioId: number) => {
  const anuncio = await getCuponVigente(anuncioId);
  if (anuncio.audiencia === 'no_registrados')
    throw new Error('Este cupón es solo para visitantes sin cuenta');

  const previos = await prisma.descuentoCodigo.findMany({
    where: { user_id: userId, estado: { in: ['activo', 'canjeado'] } },
    include: { anuncio: { include: { categorias: true } } },
  });

  const mismo = previos.find((c) => c.anuncio_id === anuncioId);
  if (mismo?.estado === 'canjeado') throw conflict('Ya usaste este cupón');
  if (mismo) return mismo; // ya tiene su código: se reenvía el mismo

  // Un código activo por tipo: no puede tener otro vivo que cubra lo mismo
  const cats = new Set(anuncio.categorias.map((c) => c.categoria_id));
  const conflicto = previos.find(
    (c) =>
      c.estado === 'activo' &&
      ((anuncio.aplica_combos && c.anuncio.aplica_combos) ||
        c.anuncio.categorias.some((x) => cats.has(x.categoria_id))),
  );
  if (conflicto)
    throw conflict(`Ya tienes un código activo para ese tipo de productos (${conflicto.codigo})`);

  return crearCodigoUnico(anuncioId, userId);
};

/** Emite un código para un visitante sin cuenta (el navegador evita repetir). */
export const emitirCodigoAnonimo = async (anuncioId: number) => {
  const anuncio = await getCuponVigente(anuncioId);
  if (anuncio.audiencia === 'registrados')
    throw new Error('Este cupón es solo para cuentas registradas');
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

/**
 * Libera los códigos enlazados a una venta (editada sin código o eliminada):
 * vuelven a estar activos para que la persona pueda usarlos en otra compra.
 */
export const liberarCodigoDeVenta = async (ventaId: number, exceptoCodigo?: string | null) => {
  await prisma.descuentoCodigo.updateMany({
    where: {
      venta_id: ventaId,
      ...(exceptoCodigo ? { NOT: { codigo: normalizarCodigo(exceptoCodigo) } } : {}),
    },
    data: { venta_id: null, estado: 'activo', canjeado_at: null },
  });
};
