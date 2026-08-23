import type { Combo } from '../../domain/entities/combo.schema';
import { urls } from '../../infrastructure/api/urls';
import { useDetallePorSlug } from './useDetallePorSlug';

/** Fuera del hook a propósito: ver la nota en `usePerfumeDetail`. */
const RUTAS = { uno: urls.combos.porSlug, relacionados: urls.combos.relacionados };

export function useComboDetail(slug: string | undefined) {
  const { item, related, loading, error } = useDetallePorSlug<Combo>(slug, RUTAS);
  return { combo: item, related, loading, error };
}
