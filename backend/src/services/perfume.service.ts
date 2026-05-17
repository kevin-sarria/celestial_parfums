import * as perfumeRepository from '../repositories/perfume.repository';
import { CreatePerfumeDTO } from '../types/perfume.type';

export const allPerfumes = () => perfumeRepository.selectAllParfums();

export const allPerfumesPaginated = (page: number, limit: number) =>
  perfumeRepository.selectParfumsPaginated(page, limit);

export const createPerfume = async (data: CreatePerfumeDTO) => {
  if (!data?.nombre || !data?.precio) throw new Error('Nombre y precio son obligatorios');
  if (!data?.tipos_aroma?.length || !data?.ocasiones?.length)
    throw new Error('Debe tener al menos un aroma y una ocasión');
  return await perfumeRepository.createPerfume(data);
};

export const editPerfume = async (id: string, data: CreatePerfumeDTO) => {
  return await perfumeRepository.editPerfume(id, data);
};

export const deletePerfume = async (id: string) => {
  return await perfumeRepository.deletePerfume(id);
};

export const patchDescuentoPerfume = async (id: string, descuento: number) => {
  const d = Math.max(0, Math.min(100, descuento));
  return perfumeRepository.patchDescuentoPerfume(id, d);
};

export const patchAgotadoPerfume = async (id: string, agotado: boolean) => {
  return perfumeRepository.patchAgotadoPerfume(id, agotado);
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
