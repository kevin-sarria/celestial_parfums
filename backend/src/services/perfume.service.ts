import * as perfumeRepository from '../repositories/perfume.repository';
import * as emparejar from '../repositories/emparejarEsencias.repository';
import * as clasificacion from '../repositories/clasificacion.repository';
import * as precios from '../repositories/precio.repository';
import { CreatePerfumeDTO } from '../types/perfume.type';
import { cacheClear, cacheGet, cacheSet } from '../utils/cache';

/**
 * El catálogo completo y los destacados son las respuestas públicas más
 * pesadas y más pedidas: se cachean en memoria y las mutaciones del admin
 * las invalidan de inmediato (los cambios se ven al instante).
 */
/**
 * `todos` = incluir los despublicados. Solo lo pide el dashboard.
 *
 * OJO: cada variante tiene SU clave de caché. Compartirla serviría la lista del
 * admin —con los perfumes que sacó de la tienda— a cualquier visitante que
 * llegara justo después. Las dos empiezan por `parfums:`, así que
 * `bustCatalogoCache()` sigue limpiando ambas de un golpe.
 */
export const allPerfumes = async (todos = false) => {
  const clave = todos ? 'parfums:all:todos' : 'parfums:all';
  const hit = cacheGet<Awaited<ReturnType<typeof perfumeRepository.selectAllParfums>>>(clave);
  if (hit) return hit;
  const data = await perfumeRepository.selectAllParfums(todos);
  cacheSet(clave, data, 5 * 60_000);
  return data;
};

export const getDestacados = async () => {
  const hit = cacheGet<Awaited<ReturnType<typeof perfumeRepository.getDestacados>>>('parfums:destacados');
  if (hit) return hit;
  const data = await perfumeRepository.getDestacados();
  cacheSet('parfums:destacados', data, 5 * 60_000);
  return data;
};

/** Cualquier cambio del catálogo o de ventas enlazadas debe llamar esto. */
export const bustCatalogoCache = () => cacheClear('parfums:');

/**
 * Página del catálogo (público y dashboard) con filtros server-side. Cada
 * combinación se cachea bajo el prefijo `parfums:` para que las mutaciones
 * del admin la invaliden junto con el resto del catálogo.
 */
export const allPerfumesPaginated = async (
  page: number,
  limit: number,
  search?: string,
  filtros?: perfumeRepository.CatalogoFiltros,
  todos = false,
  columnasAnd?: object[],
) => {
  // `todos` va DENTRO de la clave: sin eso, la página que pide el dashboard
  // (con los ocultos) se le serviría al siguiente visitante de la tienda.
  const key = `parfums:page:${JSON.stringify([page, limit, search ?? '', filtros ?? null, todos, columnasAnd ?? null])}`;
  const hit = cacheGet<Awaited<ReturnType<typeof perfumeRepository.selectParfumsPaginated>>>(key);
  if (hit) return hit;
  const data = await perfumeRepository.selectParfumsPaginated(page, limit, search, filtros, todos, columnasAnd);
  cacheSet(key, data, 5 * 60_000);
  return data;
};

export const createPerfume = async (data: CreatePerfumeDTO) => {
  if (!data?.nombre || !data?.precio) throw new Error('Nombre y precio son obligatorios');
  // Aroma y ocasión ya NO son obligatorios: el catálogo dejó de ser solo
  // perfumes (una gorra no tiene notas olfativas) y al crear un producto al
  // vuelo desde una venta se completa la ficha después, con calma.
  const result = await perfumeRepository.createPerfume(data);
  bustCatalogoCache();
  return result;
};

export const editPerfume = async (id: string, data: CreatePerfumeDTO) => {
  const result = await perfumeRepository.editPerfume(id, data);
  bustCatalogoCache();
  return result;
};

export const deletePerfume = async (id: string) => {
  const result = await perfumeRepository.deletePerfume(id);
  bustCatalogoCache();
  return result;
};

export const patchDescuentoPerfume = async (id: string, descuento: number) => {
  const d = Math.max(0, Math.min(100, descuento));
  const result = await perfumeRepository.patchDescuentoPerfume(id, d);
  bustCatalogoCache();
  return result;
};

/** Aplica el mismo % de descuento a todos los perfumes de una categoría. */
export const patchDescuentoPorCategoria = async (categoriaId: number, descuento: number) => {
  const d = Math.max(0, Math.min(100, descuento));
  const count = await perfumeRepository.patchDescuentoPorCategoria(categoriaId, d);
  bustCatalogoCache();
  return count;
};

export const asignarEsenciaMasiva = async (perfumeIds: number[], insumoId: number | null) => {
  const count = await perfumeRepository.asignarEsenciaMasiva(perfumeIds, insumoId);
  bustCatalogoCache();
  return count;
};

export const sugerirEsencias = () => emparejar.sugerirEsencias();

/** Puesta al día: qué esencias no tienen perfume y con cuál podrían emparejarse. */
export const proponerEmparejamientos = () => emparejar.proponerEmparejamientos();

export const aplicarEmparejamientos = async (acciones: emparejar.AccionEmparejar[]) => {
  const r = await emparejar.aplicarEmparejamientos(acciones);
  // Se crean perfumes y se cambian enlaces: el catálogo cacheado quedaría viejo
  if (r.enlazados || r.creados) bustCatalogoCache();
  return r;
};

export const aplicarEnlacesEsencia = async (
  enlaces: { perfume_id: number; insumo_esencia_id: number }[],
) => {
  const count = await emparejar.aplicarEnlacesEsencia(enlaces);
  bustCatalogoCache();
  return count;
};

export const patchAgotadoPerfume = async (id: string, agotado: boolean) => {
  const result = await perfumeRepository.patchAgotadoPerfume(id, agotado);
  bustCatalogoCache();
  return result;
};

export const patchPublicadoPerfume = async (id: string, publicado: boolean) => {
  const result = await perfumeRepository.patchPublicadoPerfume(id, publicado);
  // Sin esto el catálogo seguiría sirviéndose del caché y el perfume tardaría
  // hasta 4 minutos en desaparecer (o en volver) de la tienda.
  bustCatalogoCache();
  return result;
};

export const resumenPublicacion = () => perfumeRepository.resumenPublicacion();

export const getPrecios = () => precios.selectPrecios();

/** Cambiar un precio de la lista mueve a todos los perfumes que lo heredan. */
export const setPrecioLista = async (
  categoriaId: number,
  presentacionId: number,
  precio: number | null,
) => {
  const result = await precios.setPrecioLista(categoriaId, presentacionId, precio);
  bustCatalogoCache();
  return result;
};

export const getPerfumeBySlug = async (slug: string) => {
  const normalizedSlug = slug.toLowerCase().trim();
  const perfume = await perfumeRepository.findPerfumeBySlug(normalizedSlug);
  if (!perfume) throw new Error('Perfume no encontrado');
  return perfume;
};

export const getRelatedPerfumes = async (slug: string) => {
  const normalizedSlug = slug.toLowerCase().trim();
  const perfume = await perfumeRepository.findPerfumeBySlug(normalizedSlug);
  if (!perfume) throw new Error('Perfume no encontrado');
  return perfumeRepository.findRelatedPerfumes(perfume.id, perfume.tipos_aroma);
};

export const getAllAromas = async () => {
  return await clasificacion.getAllAromas();
};

export const createAroma = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre del aroma es obligatorio');
  return await clasificacion.createAroma(nombre.trim());
};

export const deleteAroma = async (id: string) => {
  return await clasificacion.deleteAroma(id);
};

export const updateAroma = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre del aroma es obligatorio');
  return await clasificacion.updateAroma(id, nombre.trim());
};

export const getAllOcasiones = async () => {
  return await clasificacion.getAllOcasiones();
};

export const createOcasion = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la ocasión es obligatorio');
  return await clasificacion.createOcasion(nombre.trim());
};

export const deleteOcasion = async (id: string) => {
  return await clasificacion.deleteOcasion(id);
};

export const updateOcasion = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la ocasión es obligatorio');
  return await clasificacion.updateOcasion(id, nombre.trim());
};

export const getAllCategorias = async () => {
  return await clasificacion.getAllCategorias();
};

export const createCategoria = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return await clasificacion.createCategoria(nombre.trim());
};

/**
 * @param destino a qué categoría se mudan sus perfumes. Es OBLIGATORIO si la
 * categoría está en uso: sin él quedarían sin categoría y perderían el precio
 * de la lista (categoría × talla), que es de donde sale lo que cuestan.
 */
export const deleteCategoria = async (id: string, destino?: string) => {
  const destinoId = destino ? Number(destino) : null;
  if (destino && !Number.isInteger(destinoId)) throw new Error('Categoría de destino inválida');
  return await clasificacion.deleteCategoriaConMudanza(Number(id), destinoId);
};

export const updateCategoria = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return await clasificacion.updateCategoria(id, nombre.trim());
};

export const getAllPresentaciones = async () => {
  return await clasificacion.getAllPresentaciones();
};

export const createPresentacion = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la presentación es obligatorio');
  return await clasificacion.createPresentacion(nombre.trim());
};

export const deletePresentacion = async (id: string) => {
  return await clasificacion.deletePresentacion(id);
};

export const updatePresentacion = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la presentación es obligatorio');
  return await clasificacion.updatePresentacion(id, nombre.trim());
};
