/**
 * PUBLICIDAD: las ventanas emergentes del catálogo y sus cupones.
 *
 * Un anuncio de tipo `descuento` es además un cupón: por eso el código
 * validado vive aquí y no con las ventas.
 */

/** Ventana emergente configurable del catálogo (publicidad). */
export interface Anuncio {
  id: number;
  titulo: string;
  mensaje: string | null;
  imagen_url: string | null;
  tipo: 'imagen' | 'mensaje' | 'descuento';
  audiencia: 'todos' | 'no_registrados' | 'registrados';
  una_vez: boolean;
  activo: boolean;
  orden: number;
  inicio: string | null;
  fin: string | null;
  descuento_pct: number;
  aplica_combos: boolean;
  /** Reglas para que el cupón aplique en el carrito (0 = sin mínimo). */
  min_unidades: number;
  min_monto: number;
  /** Guardarraíles (0 = sin límite): tope del descuento en pesos y cupo de canjes. */
  max_descuento: number;
  max_canjes: number;
  categoria_ids: number[];
  categorias: string[];
  /** Códigos emitidos sin canjear / canjeados en ventas pagadas. */
  codigos_activos: number;
  codigos_canjeados: number;
}

export interface AnuncioForm {
  titulo: string; mensaje: string; imagen_url: string;
  tipo: Anuncio['tipo']; audiencia: Anuncio['audiencia'];
  una_vez: boolean; activo: boolean; orden: string;
  inicio: string; fin: string;
  descuento_pct: string; aplica_combos: boolean; categoria_ids: number[];
  min_unidades: string; min_monto: string;
  max_descuento: string; max_canjes: string;
}

export const emptyAnuncioForm = (): AnuncioForm => ({
  titulo: '', mensaje: '', imagen_url: '',
  tipo: 'mensaje', audiencia: 'todos',
  una_vez: true, activo: true, orden: '0',
  inicio: '', fin: '',
  descuento_pct: '10', aplica_combos: false, categoria_ids: [],
  min_unidades: '0', min_monto: '0',
  max_descuento: '0', max_canjes: '0',
});

/** Resultado de la certificación de un código de descuento (admin). */
export interface CodigoValidado {
  valido: boolean;
  codigo: string;
  estado?: 'activo' | 'canjeado' | 'anulado';
  motivo: string;
  cupon?: {
    id: number; titulo: string; descuento_pct: number;
    aplica_combos: boolean; categorias: string[];
    min_unidades: number; min_monto: number;
    max_descuento: number;
  };
  persona?: string;
  emitido?: string;
  venta?: { id: number; persona: string; dia: string } | null;
}
