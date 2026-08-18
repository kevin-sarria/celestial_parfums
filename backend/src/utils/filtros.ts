/**
 * Filtros de columna, del servidor.
 *
 * El buscador global (`search`) ya viajaba al servidor y filtraba TODA la
 * data. Los filtros de columna (el embudo de cada encabezado) no: filtraban
 * `useTableControls` en el navegador, sobre las filas de la PÁGINA que ya
 * había — en una tabla de 300 ventas paginada de a 10, "Filtrar: Referencia"
 * solo miraba esas 10. Parecía funcionar en pruebas chicas y mentía en
 * cualquier tabla real. Decidido el 2026-08-18: los filtros de columna via
 * `pagination` de servidor tienen que viajar igual que la búsqueda.
 *
 * El frontend manda `?filtros=` con el JSON de `FiltersState`
 * (`frontend/src/components/table/tableTypes.ts`, columna → `FilterValue`).
 * Cada repositorio dice CÓMO se traduce cada columna suya a una condición de
 * Prisma (`MapaFiltros`); este archivo solo sabe leer el JSON y aplicar los
 * resolvers — no sabe nada de ventas, perfumes ni de ninguna tabla concreta.
 */

type FiltroString = { type: 'string'; op: 'contains' | 'equals' | 'starts'; value: string };
type FiltroNumero = { type: 'number' | 'currency'; op: 'eq' | 'gt' | 'lt'; value: string };
type FiltroFecha = { type: 'date'; op: 'eq' | 'before' | 'after'; value: string };
type FiltroEnum = { type: 'enum'; values: string[] };
export type FiltroValor = FiltroString | FiltroNumero | FiltroFecha | FiltroEnum;

/** Traduce UN filtro a una condición de Prisma, o null si no aplica (vacío, tipo raro). */
export type ResolverFiltro = (filtro: FiltroValor) => object | null;
export type MapaFiltros = Record<string, ResolverFiltro>;

const esFiltroValor = (v: unknown): v is FiltroValor =>
  !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

/**
 * Lee `?filtros=` y devuelve las condiciones ya resueltas, listas para meter
 * en un `AND` de Prisma junto al `OR` de la búsqueda. `undefined` si no había
 * filtros válidos — así el `where` de quien llama no cambia de forma.
 *
 * Nunca revienta con un JSON roto o una columna que no existe en el `mapa`:
 * un filtro mal formado se ignora en vez de tumbar la lista entera.
 */
export const parseFiltros = (query: { filtros?: unknown }, mapa: MapaFiltros): object[] | undefined => {
  if (typeof query.filtros !== 'string' || !query.filtros) return undefined;
  let crudo: unknown;
  try {
    crudo = JSON.parse(query.filtros);
  } catch {
    return undefined;
  }
  if (!crudo || typeof crudo !== 'object') return undefined;

  const condiciones: object[] = [];
  for (const [clave, filtro] of Object.entries(crudo as Record<string, unknown>)) {
    const resolver = mapa[clave];
    if (!resolver || !esFiltroValor(filtro)) continue;
    const cond = resolver(filtro);
    if (cond) condiciones.push(cond);
  }
  return condiciones.length ? condiciones : undefined;
};

// ── Resolvers reutilizables para el caso común: una columna = un campo ──────

/** Texto: contiene / es igual a / empieza con, sobre un campo `String`. */
export const filtroTexto = (campo: string): ResolverFiltro => (f) => {
  if (f.type !== 'string' || !f.value.trim()) return null;
  const value = f.value.trim().slice(0, 200);
  if (f.op === 'equals') return { [campo]: { equals: value } };
  if (f.op === 'starts') return { [campo]: { startsWith: value } };
  return { [campo]: { contains: value } };
};

/** Número o moneda: igual a / mayor que / menor que, sobre un campo numérico. */
export const filtroNumero = (campo: string): ResolverFiltro => (f) => {
  if (f.type !== 'number' && f.type !== 'currency') return null;
  const n = Number(f.value);
  if (!f.value || Number.isNaN(n)) return null;
  if (f.op === 'gt') return { [campo]: { gt: n } };
  if (f.op === 'lt') return { [campo]: { lt: n } };
  return { [campo]: n };
};

/**
 * Fecha: igual a / antes de / después de, sobre un campo `@db.Date`.
 * Sin hora que ajustar: una columna DATE no tiene zona horaria (a diferencia
 * de un timestamp), así que `new Date("2026-08-14")` cae en el mismo día que
 * escribió el dueño sin importar dónde corra el servidor.
 */
export const filtroFecha = (campo: string): ResolverFiltro => (f) => {
  if (f.type !== 'date' || !f.value) return null;
  const d = new Date(f.value);
  if (Number.isNaN(d.getTime())) return null;
  if (f.op === 'before') return { [campo]: { lt: d } };
  if (f.op === 'after') return { [campo]: { gt: d } };
  return { [campo]: d };
};

/** Lista fija (los "Pagada/Pendiente" de una casilla): el campo cae DENTRO de los valores marcados. */
export const filtroEnum = (campo: string): ResolverFiltro => (f) => {
  if (f.type !== 'enum' || !f.values.length) return null;
  return { [campo]: { in: f.values } };
};
