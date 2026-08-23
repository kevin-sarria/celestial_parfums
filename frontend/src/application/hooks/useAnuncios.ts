import { useCallback, useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
import { useAuthContext } from '../context/useAuthContext';

export interface Anuncio {
  id: number;
  titulo: string;
  mensaje: string | null;
  imagen_url: string | null;
  tipo: 'imagen' | 'mensaje' | 'descuento';
  audiencia: 'todos' | 'no_registrados' | 'registrados';
  una_vez: boolean;
  orden: number;
  descuento_pct: number;
  aplica_combos: boolean;
  categorias: string[];
  /** Reglas para que el cupón aplique en el carrito (0 = sin mínimo). */
  min_unidades: number;
  min_monto: number;
  /** Tope del descuento en pesos (0 = sin tope). */
  max_descuento: number;
}

const VISTO_KEY = (id: number) => `celestial_anuncio_visto_${id}`;
const CUPON_USADO_KEY = (id: number) => `celestial_cupon_usado_${id}`;

/**
 * Ventanas emergentes del catálogo: trae los anuncios vigentes y filtra por
 * audiencia y por "ya visto" (localStorage). El admin nunca las ve.
 */
export function useAnuncios() {
  const { user, isAdmin } = useAuthContext();
  const [pendientes, setPendientes] = useState<Anuncio[]>([]);

  useEffect(() => {
    if (isAdmin) return;
    let vivo = true;
    (async () => {
      // Los popups son opcionales: si falla, la página sigue y no sale ninguno.
      const res = await http.getCacheado<{ data?: Anuncio[] }>(urls.anuncios.publico);
      if (!vivo) return;
      setPendientes(
        (res.cuerpo?.data ?? []).filter((a) => {
          if (a.audiencia === 'registrados' && !user) return false;
          if (a.audiencia === 'no_registrados' && user) return false;
          if (a.una_vez && localStorage.getItem(VISTO_KEY(a.id))) return false;
          return true;
        }),
      );
    })();
    return () => { vivo = false; };
  }, [user, isAdmin]);

  const marcarVisto = useCallback((a: Anuncio) => {
    if (a.una_vez) localStorage.setItem(VISTO_KEY(a.id), '1');
    setPendientes((prev) => prev.filter((x) => x.id !== a.id));
  }, []);

  return { pendientes, marcarVisto };
}

export interface Cupon {
  id: number;
  titulo: string;
  descuento_pct: number;
  aplica_combos: boolean;
  categorias: string[];
  min_unidades: number;
  min_monto: number;
  /** Tope del descuento en pesos (0 = sin tope). */
  max_descuento: number;
}

/**
 * Cupones de descuento disponibles para el carrito. Nunca se acumulan entre sí
 * sobre el mismo producto: cada producto recibe como mucho UN cupón, y solo si
 * no tiene descuento propio. Al enviar el pedido se emite un código único de un
 * solo uso por cupón (viaja en el mensaje de WhatsApp y el admin lo valida).
 */
export function useCupones() {
  const { user, isAdmin } = useAuthContext();
  const [cupones, setCupones] = useState<Cupon[]>([]);

  const refresh = useCallback(async () => {
    if (isAdmin) { setCupones([]); return; }
    if (user) {
      const res = await http.get<{ data?: Cupon[] }>(urls.portal.descuentos);
      setCupones(res.cuerpo?.data ?? []);
      return;
    }
    // Sin cuenta: cupones de audiencia todos/no_registrados no usados en este navegador
    const res = await http.getCacheado<{ data?: Anuncio[] }>(urls.anuncios.publico);
    setCupones(
      (res.cuerpo?.data ?? []).filter(
        (a) =>
          a.tipo === 'descuento' &&
          a.audiencia !== 'registrados' &&
          !localStorage.getItem(CUPON_USADO_KEY(a.id)),
      ),
    );
  }, [user, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Emite el código único del cupón al enviar el pedido (consume el cupón).
   * Devuelve null si la emisión falla: el pedido sigue y el admin decide.
   */
  const emitirCodigo = useCallback(async (cupon: Cupon): Promise<string | null> => {
    const res = await http.post<{ data?: { codigo?: string } }>(
      user ? urls.portal.emitirCodigo(cupon.id) : urls.anuncios.emitirCodigo(cupon.id),
    );
    /**
     * Falle o no, el cupón sale de la lista y queda marcado como usado. Es a
     * propósito y no es un handler mudo: reintentar podría emitir DOS códigos
     * del mismo cupón, y el pedido de WhatsApp sale igual — el admin decide al
     * validarlo. Por eso `null` no es un error que tapar, es la respuesta.
     */
    if (!user) localStorage.setItem(CUPON_USADO_KEY(cupon.id), '1');
    setCupones((prev) => prev.filter((c) => c.id !== cupon.id));
    return res.ok ? (res.cuerpo?.data?.codigo ?? null) : null;
  }, [user]);

  return { cupones, emitirCodigo };
}
