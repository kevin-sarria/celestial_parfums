import { createContext, useContext } from 'react';

/** Favoritos y avisos de stock del cliente (Sets de perfume_id) + acciones. */
export interface ListasCtx {
  favoritos: Set<number>;
  avisos: Set<number>;
  toggleFavorito: (perfumeId: number) => void;
  toggleAviso: (perfumeId: number) => void;
  recargar: () => void;
}

export const ListasContext = createContext<ListasCtx | null>(null);

export function useListas(): ListasCtx {
  const ctx = useContext(ListasContext);
  if (!ctx) throw new Error('useListas debe usarse dentro de <ListasProvider>');
  return ctx;
}
