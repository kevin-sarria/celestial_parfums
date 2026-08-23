import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { notFound } from '../utils/httpError';
import { DIAS_PLAZO_CREDITO, sumarDias } from '../utils/fechas';
import { CreateCreditoDTO } from '../types/credito.type';
import { paginatedResponse } from '../utils/pagination';
import { filtroFecha, filtroNumero, filtroTexto, type MapaFiltros } from '../utils/filtros';

/**
 * "Abonado" y "En deuda" no están: se calculan en `mapCredito` a partir de los
 * abonos de cada crédito, no son una columna que Prisma pueda comparar sin
 * traer y sumar TODOS los créditos primero. Quedan `filterable: false` en
 * `columns.tsx`, a propósito, para no ofrecer un embudo que no filtra de verdad.
 */
export const mapaFiltrosCreditos: MapaFiltros = {
  articulos: filtroTexto('articulos'),
  fecha: filtroFecha('fecha'),
  fecha_limite: filtroFecha('fecha_limite'),
  deuda_inicial: filtroNumero('deuda_inicial'),
  cliente: (f) => (f.type === 'string' && f.value.trim()
    ? { user: { OR: [
        { nombre: { contains: f.value.trim() } },
        { apellido: { contains: f.value.trim() } },
      ] } }
    : null),
  telefono: (f) => (f.type === 'string' && f.value.trim()
    ? { user: { telefono: { contains: f.value.trim() } } } : null),
};
import { agruparEnlaces, buildPerfumeIndex, matchPerfumes } from '../utils/perfumeMatcher';
import { canjearCodigoEnCredito, liberarCodigoDeVenta } from '../services/anuncio.service';

const includeAll = {
  user: { select: { id: true, nombre: true, apellido: true, telefono: true, email: true, direccion: true, sin_cuenta: true } },
  abonos: { orderBy: { created_at: 'asc' as const } },
  venta: {
    select: {
      id: true,
      pagada: true,
      presentacion: true,
      // Productos enlazados: para reconstruir las líneas al editar
      perfumes: { select: { perfume_id: true, cantidad: true } },
      codigo: { select: { codigo: true, estado: true, anuncio: { select: { titulo: true, descuento_pct: true, max_descuento: true } } } },
    },
  },
} as const;

/**
 * Fecha límite pactada: la que se envía, o el plazo por defecto contado desde
 * la fecha del crédito. Cuántos días son y por qué, en `utils/fechas.ts`.
 */
const calcularFechaLimite = (fecha: string, limite?: string | null) =>
  new Date(limite ?? sumarDias(fecha, DIAS_PLAZO_CREDITO));

/** La fila del crédito con todo lo que `includeAll` arrastra (cliente, abonos, venta). */
type CreditoRow = Prisma.CreditoGetPayload<{ include: typeof includeAll }>;

const mapCredito = (c: CreditoRow) => {
  const abonos = (c.abonos ?? []).map((a) => ({
    id: a.id,
    monto: Number(a.monto),
    fecha: a.fecha,
  }));

  const totalAbonado = abonos.reduce((acc, a) => acc + a.monto, 0);
  const deudaInicial = Number(c.deuda_inicial);

  const saldo = Math.max(0, deudaInicial - totalAbonado);
  const codigo = c.venta?.codigo ?? null;
  // Vencido = sigue debiendo hoy y ya pasó la fecha límite pactada
  const vencido =
    saldo > 0 && c.fecha_limite != null && Date.now() > new Date(c.fecha_limite).getTime();

  return {
    id:    c.id,
    fecha: c.fecha,
    fecha_limite: c.fecha_limite ?? null,
    // "cliente" para el panel = la persona (usuario o ficha) dueña del crédito
    cliente: {
      id:         c.user.id,
      nombre:     c.user.nombre,
      apellido:   c.user.apellido,
      telefono:   c.user.telefono ?? null,
      correo:     c.user.sin_cuenta ? null : c.user.email,
      direccion:  c.user.direccion ?? null,
      sin_cuenta: c.user.sin_cuenta,
    },
    articulos:      c.articulos,
    deuda_inicial:  deudaInicial,
    abonos,
    total_abonado:  totalAbonado,
    total_en_deuda: saldo,
    vencido,
    // Cupón usado en este crédito (ya canjeado): para mostrarlo y para editar
    codigo: codigo
      ? {
          codigo: codigo.codigo,
          descuento_pct: codigo.anuncio?.descuento_pct ?? 0,
          max_descuento: Number(codigo.anuncio?.max_descuento ?? 0),
          titulo: codigo.anuncio?.titulo ?? '',
        }
      : null,
    // Presentación y productos de la venta enlazada (para reconstruir el editor)
    presentacion: c.venta?.presentacion ?? '',
    productos: (c.venta?.perfumes ?? []).map((p) => ({ perfume_id: p.perfume_id, cantidad: p.cantidad })),
    venta:          c.venta ? { id: c.venta.id, pagada: c.venta.pagada } : null,
    created_at:     c.created_at,
  };
};

/**
 * Relee el crédito recién guardado para devolverlo ya mapeado.
 *
 * El `null` de `findUnique` no es un detalle de tipos: si alguien borró el
 * crédito entre la escritura y esta lectura, el mapeador reventaba con un
 * "Cannot read properties of null" y el dueño veía un error 500 sin sentido.
 * Ahora responde "ya no existe", que es lo que pasó.
 */
const releerCredito = async (id: number) => {
  const row = await prisma.credito.findUnique({ where: { id }, include: includeAll });
  if (!row) throw notFound('Ese crédito ya no existe');
  return mapCredito(row);
};

/**
 * Listado paginado y, **si se piden, sus totales en la misma respuesta**.
 *
 * Mismo criterio que en ventas: la pantalla pinta lista y totales a la vez, y
 * pedirlos por separado son dos viajes al servidor para lo mismo. Aquí salen
 * en paralelo dentro del mismo `Promise.all`. Bajo petición, para que quien
 * solo quiera la lista no pague la agregación.
 */
export const getAllCreditos = async (
  page: number, limit: number, search?: string, conTotales = false, filtrosAnd?: object[],
) => {
  const skip = (page - 1) * limit;
  const condiciones: object[] = [];
  if (search) {
    condiciones.push({
      OR: [
        { articulos: { contains: search } },
        { user: { nombre: { contains: search } } },
        { user: { apellido: { contains: search } } },
        { user: { telefono: { contains: search } } },
        { user: { email: { contains: search } } },
      ],
    });
  }
  if (filtrosAnd?.length) condiciones.push(...filtrosAnd);
  const where = condiciones.length ? { AND: condiciones } : undefined;
  const [rows, total, totales] = await Promise.all([
    prisma.credito.findMany({ where, skip, take: limit, orderBy: { fecha: 'desc' }, include: includeAll }),
    prisma.credito.count({ where }),
    conTotales ? getCreditoTotales() : undefined,
  ]);
  return {
    ...paginatedResponse(rows.map(mapCredito), total, page, limit),
    ...(totales ? { totales } : {}),
  };
};

/**
 * Un crédito genera su venta enlazada (pendiente de pago): los perfumes
 * salieron ese día y deben contar en el módulo de ventas. Los perfumes del
 * catálogo se detectan del texto de artículos (igual que en las importaciones).
 */
export const createCredito = async (data: CreateCreditoDTO) => {
  const [user, catalogo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.user_id },
      select: { nombre: true, apellido: true },
    }),
    prisma.perfume.findMany({ select: { id: true, nombre: true } }),
  ]);
  if (!user) throw new Error('La persona del crédito no existe');

  // Con productos elegidos (formulario nuevo) se usan directo; sin ellos
  // (importador de Excel) se infieren del texto libre de artículos.
  const perfumeIds = data.perfume_ids?.length
    ? data.perfume_ids
    : matchPerfumes(data.articulos, buildPerfumeIndex(catalogo));
  const presentacion = (data.presentacion?.trim() || '—').slice(0, 100);
  const codigo = data.codigo_descuento?.trim() || null;
  // `deuda_inicial` ya viene con el cupón aplicado (lo calcula el formulario);
  // el backend solo la guarda y consume el código. Se valida el código ANTES de
  // crear nada para no dejar un crédito a medias.
  const deuda = data.deuda_inicial;

  const row = await prisma.$transaction(async (tx) => {
    const venta = await tx.venta.create({
      data: {
        dia:                new Date(data.fecha),
        persona:            `${user.nombre} ${user.apellido}`.trim(),
        user_id:            data.user_id,
        cantidad_perfumes:  Math.max(1, perfumeIds.length),
        presentacion,
        referencia_perfume: data.articulos,
        perfumes:           { create: agruparEnlaces(perfumeIds) },
        valor_venta:        deuda,
        datos_adicionales:  'Venta a crédito (se marca pagada al saldar el crédito)',
        pagada:             false,
      },
    });
    return tx.credito.create({
      data: {
        fecha:         new Date(data.fecha),
        fecha_limite:  calcularFechaLimite(data.fecha, data.fecha_limite),
        user_id:       data.user_id,
        articulos:     data.articulos,
        deuda_inicial: deuda,
        venta_id:      venta.id,
      },
      include: includeAll,
    });
  });

  // El cupón de un crédito se consume YA (un solo uso, no espera a que pague todo).
  if (codigo && row.venta_id) await canjearCodigoEnCredito(codigo, row.venta_id);

  return releerCredito(row.id);
};

/**
 * Edita un crédito y su venta enlazada CONSERVANDO los abonos. La deuda que
 * llega ya trae el cupón aplicado (lo calcula el formulario). El estado de
 * pago se recalcula contra los abonos existentes; el cupón se re-enlaza como
 * en las ventas (si se quita el código, vuelve a estar activo para el cliente).
 */
export const updateCredito = async (id: string, data: CreateCreditoDTO) => {
  const numId = Number(id);
  const existente = await prisma.credito.findUnique({
    where: { id: numId },
    include: { abonos: { select: { monto: true } }, venta: { select: { id: true } } },
  });
  if (!existente) throw new Error('Crédito no encontrado');

  const [user, catalogo] = await Promise.all([
    prisma.user.findUnique({ where: { id: data.user_id }, select: { nombre: true, apellido: true } }),
    prisma.perfume.findMany({ select: { id: true, nombre: true } }),
  ]);
  if (!user) throw new Error('La persona del crédito no existe');

  const perfumeIds = data.perfume_ids?.length
    ? data.perfume_ids
    : matchPerfumes(data.articulos, buildPerfumeIndex(catalogo));
  const presentacion = (data.presentacion?.trim() || '—').slice(0, 100);
  const codigo = data.codigo_descuento?.trim() || null;
  const deuda = data.deuda_inicial;
  const abonado = existente.abonos.reduce((s, a) => s + Number(a.monto), 0);
  const pagada = abonado >= deuda;
  const ventaId = existente.venta_id;

  await prisma.$transaction(async (tx) => {
    if (ventaId) {
      await tx.venta.update({
        where: { id: ventaId },
        data: {
          dia:                new Date(data.fecha),
          persona:            `${user.nombre} ${user.apellido}`.trim(),
          user_id:            data.user_id,
          cantidad_perfumes:  Math.max(1, perfumeIds.length),
          presentacion,
          referencia_perfume: data.articulos,
          perfumes:           { deleteMany: {}, create: agruparEnlaces(perfumeIds) },
          valor_venta:        deuda,
          pagada,
        },
      });
    }
    await tx.credito.update({
      where: { id: numId },
      data: {
        fecha:         new Date(data.fecha),
        fecha_limite:  calcularFechaLimite(data.fecha, data.fecha_limite),
        user_id:       data.user_id,
        articulos:     data.articulos,
        deuda_inicial: deuda,
      },
    });
  });

  // Cupón: se libera el anterior (salvo que sea el mismo) y se re-canjea el nuevo.
  // Quitar el código lo devuelve a "activo" para que el cliente lo use en otra compra.
  if (ventaId) {
    await liberarCodigoDeVenta(ventaId, codigo);
    if (codigo) await canjearCodigoEnCredito(codigo, ventaId);
  }

  return releerCredito(numId);
};

/** La venta enlazada refleja el estado real de la deuda: pagada ⇔ saldada. */
const sincronizarVenta = async (creditoId: number) => {
  const credito = await prisma.credito.findUnique({
    where: { id: creditoId },
    include: { abonos: { select: { monto: true } }, venta: { select: { id: true, pagada: true } } },
  });
  if (!credito?.venta) return;
  const abonado = credito.abonos.reduce((s, a) => s + Number(a.monto), 0);
  const saldada = abonado >= Number(credito.deuda_inicial);
  if (credito.venta.pagada !== saldada) {
    await prisma.venta.update({ where: { id: credito.venta.id }, data: { pagada: saldada } });
  }
};

export const addAbono = async (id: string, monto: number) => {
  const credito = await prisma.credito.findUnique({ where: { id: Number(id) } });
  if (!credito) throw new Error('Crédito no encontrado');

  await prisma.creditoAbono.create({
    data: {
      credito_id: Number(id),
      monto,
      fecha: new Date(),
    },
  });
  await sincronizarVenta(Number(id));

  return releerCredito(Number(id));
};

export const deleteAbono = async (abonoId: string) => {
  const abono = await prisma.creditoAbono.delete({ where: { id: Number(abonoId) } });
  // Si al quitar el abono la deuda se reabre, la venta vuelve a quedar pendiente
  await sincronizarVenta(abono.credito_id);
};

export const deleteCredito = async (id: string) => {
  const credito = await prisma.credito.delete({ where: { id: Number(id) } });
  // La venta nació con el crédito: si el crédito fue un error, la venta también.
  // El cupón se libera (vuelve a activo): borrar el crédito revierte la compra.
  if (credito.venta_id) {
    await liberarCodigoDeVenta(credito.venta_id);
    await prisma.venta.delete({ where: { id: credito.venta_id } }).catch(() => {});
  }
  return credito;
};

/**
 * Resumen de la cartera para las tarjetas de la pestaña Créditos.
 *
 * Hace falta un endpoint porque "cuánto te deben" NO se puede calcular con la
 * página que está en pantalla: daría un número que cambia al pasar de página.
 *
 * Se traen los créditos y sus abonos y se calcula en memoria, con el MISMO
 * criterio que `mapCredito`. Es a propósito: si el total se calculara con otra
 * fórmula, tarde o temprano la caja de arriba y la tabla de abajo dirían cosas
 * distintas, y ahí ya no se sabe a cuál creerle.
 */
export const getCreditoTotales = async () => {
  const ahora = new Date();
  // Medianoche UTC: con hora local, todo lo del día 1 se saldría del mes
  const inicioMes = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1));

  const creditos = await prisma.credito.findMany({
    select: {
      user_id: true,
      deuda_inicial: true,
      fecha_limite: true,
      abonos: { select: { monto: true, fecha: true } },
    },
  });

  let totalEnDeuda = 0;
  let vencido = 0;
  let creditosVencidos = 0;
  let abonadoMes = 0;
  const deudores = new Set<number>();

  for (const c of creditos) {
    const abonado = c.abonos.reduce((s, a) => s + Number(a.monto), 0);
    const saldo = Math.max(0, Number(c.deuda_inicial) - abonado);

    abonadoMes += c.abonos
      .filter((a) => a.fecha >= inicioMes)
      .reduce((s, a) => s + Number(a.monto), 0);

    if (saldo > 0) {
      totalEnDeuda += saldo;
      deudores.add(c.user_id);
      // Vencido = sigue debiendo y ya pasó la fecha límite pactada
      if (c.fecha_limite != null && Date.now() > c.fecha_limite.getTime()) {
        vencido += saldo;
        creditosVencidos += 1;
      }
    }
  }

  return {
    total_en_deuda: Math.round(totalEnDeuda * 100) / 100,
    clientes_con_deuda: deudores.size,
    vencido: Math.round(vencido * 100) / 100,
    creditos_vencidos: creditosVencidos,
    abonado_mes: Math.round(abonadoMes * 100) / 100,
  };
};
