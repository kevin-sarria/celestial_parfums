import type { PerfumeForm } from '../../types';

/**
 * LOS CUATRO TIPOS DE ALTA, en el idioma del dueño.
 *
 * No son columnas nuevas: son combinaciones de las tres que ya existen
 * (`tipo_producto`, `solo_armado`, `es_accesorio`). Nacen de una queja suya
 * (2026-08-25): el formulario preguntaba "¿cómo consigues este producto?" en la
 * casilla número once, después de hacerle llenar la duración y la proyección de
 * una bolsa de organza. Esa pregunta decide qué campos aplican, así que va
 * primera y decide el formulario entero.
 */
export type TipoAlta = 'fragancia' | 'armado' | 'comprado' | 'decant';

export interface OpcionTipo {
  id: TipoAlta;
  emoji: string;
  titulo: string;
  detalle: string;
}

export const TIPOS_ALTA: OpcionTipo[] = [
  {
    id: 'fragancia', emoji: '🧪', titulo: 'Una fragancia que fabrico',
    detalle: 'Contratipo. Se arma cuando alguien la pide.',
  },
  {
    id: 'armado', emoji: '✨', titulo: 'Un 1.1',
    detalle: 'Lo armas antes de venderlo, con su envase premium.',
  },
  {
    id: 'comprado', emoji: '📦', titulo: 'Algo que compro hecho',
    detalle: 'Splash, perfumero, bolsa, tarjeta.',
  },
  {
    id: 'decant', emoji: '💧', titulo: 'Decants de una botella',
    detalle: 'Compras el original y sacas frascos pequeños.',
  },
];

/**
 * De qué tipo es una ficha que ya existe.
 *
 * Se deduce de los datos, nunca de una bandera aparte: una copia se
 * desincronizaría el día que alguien edite el producto por otra vía (el Excel,
 * el alta desde el lote) y entonces la ficha mostraría los campos equivocados.
 */
export const tipoDeForm = (form: Pick<PerfumeForm, 'tipo_producto' | 'solo_armado' | 'es_accesorio'>): TipoAlta => {
  if (form.solo_armado) return 'armado';
  if (form.tipo_producto === 'fraccionado') return 'decant';
  if (form.tipo_producto === 'comprado') return 'comprado';
  return 'fragancia';
};

/** Con qué valores arranca el formulario según la puerta elegida. */
export const valoresDeTipo = (tipo: TipoAlta): Partial<PerfumeForm> => (({
  fragancia: { tipo_producto: 'fabricado', solo_armado: false, es_accesorio: false },
  armado:    { tipo_producto: 'fabricado', solo_armado: true,  es_accesorio: false },
  comprado:  { tipo_producto: 'comprado',  solo_armado: false, es_accesorio: false },
  decant:    { tipo_producto: 'fraccionado', solo_armado: false, es_accesorio: false },
}) as Record<TipoAlta, Partial<PerfumeForm>>)[tipo];

/**
 * Qué muestra el formulario de cada tipo.
 *
 * Un perfumero no tiene duración, ni proyección, ni notas, ni talla: pedirlas
 * es lo que convertía su alta en 16 casillas. Y al revés, el insumo que ES el
 * producto no aplica a un contratipo, que se fabrica.
 */
export interface CamposDelTipo {
  /** Duración, proyección, género, notas y ocasiones: cosas de una fragancia. */
  atributosDeFragancia: boolean;
  /** Tallas con su precio y su envase. */
  tallas: boolean;
  /** Con qué esencia se costea. */
  esencia: boolean;
  /** El insumo del que sale (el producto que se revende o la botella origen). */
  insumoOrigen: boolean;
  /** Cuántos ml se aprovechan de la botella. */
  mlUtiles: boolean;
  /** La casilla de accesorio (perfumero, bolsa, tarjeta). */
  accesorio: boolean;
  /** La pregunta "¿lo preparas tú o lo compras hecho?" (solo los 1.1). */
  preparadoOComprado: boolean;
}

export const CAMPOS_POR_TIPO: Record<TipoAlta, CamposDelTipo> = {
  fragancia: {
    atributosDeFragancia: true, tallas: true, esencia: true,
    insumoOrigen: false, mlUtiles: false, accesorio: false, preparadoOComprado: false,
  },
  armado: {
    // Un 1.1 SÍ es una fragancia: se busca por notas y se vende por ocasión.
    atributosDeFragancia: true, tallas: true, esencia: true,
    insumoOrigen: false, mlUtiles: false, accesorio: false, preparadoOComprado: true,
  },
  comprado: {
    atributosDeFragancia: false, tallas: false, esencia: false,
    insumoOrigen: true, mlUtiles: false, accesorio: true, preparadoOComprado: false,
  },
  decant: {
    atributosDeFragancia: true, tallas: true, esencia: false,
    insumoOrigen: true, mlUtiles: true, accesorio: false, preparadoOComprado: false,
  },
};
