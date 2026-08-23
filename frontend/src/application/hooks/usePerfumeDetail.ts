import type { Perfume } from '../../domain/entities/perfume.schema';
import { urls } from '../../infrastructure/api/urls';
import { useDetallePorSlug } from './useDetallePorSlug';

/** Fuera del hook a propósito: si se creara en cada render, el efecto de
 *  `useDetallePorSlug` lo vería siempre nuevo y no pararía de pedir. */
const RUTAS = { uno: urls.perfumes.porSlug, relacionados: urls.perfumes.relacionados };

export function usePerfumeDetail(slug: string | undefined) {
  const { item, related, loading, error } = useDetallePorSlug<Perfume>(slug, RUTAS);
  return { perfume: item, related, loading, error };
}
