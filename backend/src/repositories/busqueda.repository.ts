import { prisma } from '../config/prisma';
import { lineaDeCatalogo, TAB_DE_LINEA } from './perfume.linea';

/**
 * EL BUSCADOR GENERAL del panel (2026-10-02, segunda tanda de la revisión).
 *
 * Una caja que busca a la vez en lo que el dueño más consulta: fichas del
 * catálogo, clientes, ventas, créditos y materiales. Responde POCO de cada
 * cosa —es para saltar, no para listar— y cada resultado dice a qué pestaña
 * llevar; la pestaña abre ya filtrada por ese texto (`?buscar=`).
 *
 * Lleva costos y datos de clientes: solo admin (lo exige el router).
 */

const POR_GRUPO = 5;

export interface ResultadoBusqueda {
  grupo: 'Catálogo' | 'Clientes' | 'Ventas' | 'Créditos' | 'Materiales';
  titulo: string;
  detalle: string;
  /** Pestaña del panel a la que lleva. */
  tab: string;
  /** Texto con el que la pestaña abre filtrada. */
  buscar: string;
}

/**
 * Día de una columna `@db.Date` como "dd/mm/aaaa". Prisma la lee a medianoche
 * UTC, así que el día sale de las partes UTC (las locales lo correrían uno
 * atrás en Colombia).
 */
const fecha = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const pesos = (n: unknown) => `$${Math.round(Number(n)).toLocaleString('es-CO')}`;

export const buscarEnTodo = async (texto: string): Promise<ResultadoBusqueda[]> => {
  const q = texto.trim();
  if (q.length < 2) return [];
  const contiene = { contains: q };
  const numero = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null;

  const [perfumes, clientes, ventas, creditos, materiales] = await Promise.all([
    prisma.perfume.findMany({
      where: { nombre: contiene },
      select: { nombre: true, publicado: true, solo_armado: true, tipo_producto: true, es_accesorio: true },
      orderBy: { nombre: 'asc' }, take: POR_GRUPO,
    }),
    prisma.user.findMany({
      where: { rol_id: { not: 1 }, OR: [{ nombre: contiene }, { apellido: contiene }, { email: contiene }, { telefono: contiene }] },
      select: { nombre: true, apellido: true, email: true, telefono: true, sin_cuenta: true },
      orderBy: { nombre: 'asc' }, take: POR_GRUPO,
    }),
    prisma.venta.findMany({
      where: numero != null ? { id: numero } : { OR: [{ persona: contiene }, { referencia_perfume: contiene }] },
      select: { id: true, dia: true, persona: true, valor_venta: true, referencia_perfume: true },
      orderBy: { id: 'desc' }, take: POR_GRUPO,
    }),
    prisma.credito.findMany({
      where: { OR: [{ user: { nombre: contiene } }, { user: { apellido: contiene } }, { articulos: contiene }] },
      select: { fecha: true, articulos: true, deuda_inicial: true, user: { select: { nombre: true, apellido: true } } },
      orderBy: { id: 'desc' }, take: POR_GRUPO,
    }),
    prisma.insumoCosto.findMany({
      where: { nombre: contiene },
      select: { nombre: true, stock: true, unidad: true },
      orderBy: { nombre: 'asc' }, take: POR_GRUPO,
    }),
  ]);

  return [
    ...perfumes.map((p): ResultadoBusqueda => ({
      grupo: 'Catálogo', titulo: p.nombre,
      detalle: p.publicado ? 'En la tienda' : 'Fuera de la tienda',
      tab: TAB_DE_LINEA[lineaDeCatalogo({ solo_armado: p.solo_armado, tipo_producto: p.tipo_producto ?? undefined, es_accesorio: p.es_accesorio })],
      buscar: p.nombre,
    })),
    ...clientes.map((u): ResultadoBusqueda => ({
      grupo: 'Clientes', titulo: `${u.nombre} ${u.apellido}`.trim(),
      detalle: u.sin_cuenta ? (u.telefono ?? 'Ficha sin cuenta web') : u.email,
      tab: 'usuarios', buscar: u.sin_cuenta ? u.nombre : u.email,
    })),
    ...ventas.map((v): ResultadoBusqueda => ({
      grupo: 'Ventas', titulo: `Venta #${v.id} · ${v.persona}`,
      detalle: `${fecha(v.dia)} · ${pesos(v.valor_venta)} · ${v.referencia_perfume}`,
      tab: 'ventas', buscar: v.persona,
    })),
    ...creditos.map((c): ResultadoBusqueda => ({
      grupo: 'Créditos', titulo: `${c.user.nombre} ${c.user.apellido}`.trim(),
      detalle: `${fecha(c.fecha)} · ${pesos(c.deuda_inicial)} · ${c.articulos}`,
      tab: 'creditos', buscar: c.user.nombre,
    })),
    ...materiales.map((m): ResultadoBusqueda => ({
      grupo: 'Materiales', titulo: m.nombre,
      detalle: `Quedan ${Number(m.stock).toLocaleString('es-CO')} ${m.unidad === 'ml' ? 'ml' : 'unidades'}`,
      tab: 'inventario', buscar: m.nombre,
    })),
  ];
};
