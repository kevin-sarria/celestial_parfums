import * as perfumeRepository from '../repositories/perfume.repository';
import { CreatePerfumeDTO } from '../types/perfume.type';
import { cacheClear, cacheGet, cacheSet } from '../utils/cache';

/**
 * El catálogo completo y los destacados son las respuestas públicas más
 * pesadas y más pedidas: se cachean en memoria y las mutaciones del admin
 * las invalidan de inmediato (los cambios se ven al instante).
 */
export const allPerfumes = async () => {
  const hit = cacheGet<Awaited<ReturnType<typeof perfumeRepository.selectAllParfums>>>('parfums:all');
  if (hit) return hit;
  const data = await perfumeRepository.selectAllParfums();
  cacheSet('parfums:all', data, 5 * 60_000);
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
) => {
  const key = `parfums:page:${JSON.stringify([page, limit, search ?? '', filtros ?? null])}`;
  const hit = cacheGet<Awaited<ReturnType<typeof perfumeRepository.selectParfumsPaginated>>>(key);
  if (hit) return hit;
  const data = await perfumeRepository.selectParfumsPaginated(page, limit, search, filtros);
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

export const patchAgotadoPerfume = async (id: string, agotado: boolean) => {
  const result = await perfumeRepository.patchAgotadoPerfume(id, agotado);
  bustCatalogoCache();
  return result;
};

export const getPrecios = () => perfumeRepository.selectPrecios();

/** Cambiar un precio de la lista mueve a todos los perfumes que lo heredan. */
export const setPrecioLista = async (
  categoriaId: number,
  presentacionId: number,
  precio: number | null,
) => {
  const result = await perfumeRepository.setPrecioLista(categoriaId, presentacionId, precio);
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
  return await perfumeRepository.getAllAromas();
};

export const createAroma = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre del aroma es obligatorio');
  return await perfumeRepository.createAroma(nombre.trim());
};

export const deleteAroma = async (id: string) => {
  return await perfumeRepository.deleteAroma(id);
};

export const updateAroma = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre del aroma es obligatorio');
  return await perfumeRepository.updateAroma(id, nombre.trim());
};

export const getAllOcasiones = async () => {
  return await perfumeRepository.getAllOcasiones();
};

export const createOcasion = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la ocasión es obligatorio');
  return await perfumeRepository.createOcasion(nombre.trim());
};

export const deleteOcasion = async (id: string) => {
  return await perfumeRepository.deleteOcasion(id);
};

export const updateOcasion = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la ocasión es obligatorio');
  return await perfumeRepository.updateOcasion(id, nombre.trim());
};

export const getAllCategorias = async () => {
  return await perfumeRepository.getAllCategorias();
};

export const createCategoria = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return await perfumeRepository.createCategoria(nombre.trim());
};

export const deleteCategoria = async (id: string) => {
  return await perfumeRepository.deleteCategoria(id);
};

export const updateCategoria = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la categoría es obligatorio');
  return await perfumeRepository.updateCategoria(id, nombre.trim());
};

export const getAllPresentaciones = async () => {
  return await perfumeRepository.getAllPresentaciones();
};

export const createPresentacion = async (nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la presentación es obligatorio');
  return await perfumeRepository.createPresentacion(nombre.trim());
};

export const deletePresentacion = async (id: string) => {
  return await perfumeRepository.deletePresentacion(id);
};

export const updatePresentacion = async (id: string, nombre: string) => {
  if (!nombre?.trim()) throw new Error('El nombre de la presentación es obligatorio');
  return await perfumeRepository.updatePresentacion(id, nombre.trim());
};
