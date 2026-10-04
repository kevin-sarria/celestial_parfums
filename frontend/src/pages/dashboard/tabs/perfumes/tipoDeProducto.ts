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
    // Sigue llamándose `decant` por dentro: es `fraccionado`, la botella de la
    // que salen los decants. Desde el 2026-09-29 también vende la botella
    // completa, y el dueño lo piensa como "un original".
    id: 'decant', emoji: '💧', titulo: 'Un perfume original',
    detalle: 'Vendes la botella completa y decants de ella.',
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
  /** La casilla de accesorio (perfumero, bolsa, tarjeta). */
  accesorio: boolean;
  /** La pregunta "¿lo preparas tú o lo compras hecho?" (solo los 1.1). */
  preparadoOComprado: boolean;
}

export const CAMPOS_POR_TIPO: Record<TipoAlta, CamposDelTipo> = {
  fragancia: {
    atributosDeFragancia: true, tallas: true, esencia: true,
    insumoOrigen: false, accesorio: false, preparadoOComprado: false,
  },
  armado: {
    // Un 1.1 SÍ es una fragancia: se busca por notas y se vende por ocasión.
    atributosDeFragancia: true, tallas: true, esencia: true,
    insumoOrigen: false, accesorio: false, preparadoOComprado: true,
  },
  comprado: {
    atributosDeFragancia: false, tallas: false, esencia: false,
    insumoOrigen: true, accesorio: true, preparadoOComprado: false,
  },
  decant: {
    atributosDeFragancia: true, tallas: true, esencia: false,
    insumoOrigen: true, accesorio: false, preparadoOComprado: false,
  },
};

/**
 * LAS 4 LÍNEAS DEL CATÁLOGO DEL PANEL (2026-10-04, proyecto 3 del rediseño).
 *
 * Las pestañas del catálogo son exactamente las 4 puertas de alta: cada línea
 * se deduce de los datos (`lineaDe` en el backend) y cada una abre su puerta.
 * Accesorio y comprado comparten la pestaña de productos.
 */
export type LineaCatalogo = 'contratipo' | 'uno_uno' | 'original' | 'producto';

/** A qué puerta de alta corresponde cada línea. */
export const TIPO_DE_LINEA: Record<LineaCatalogo, TipoAlta> = {
  contratipo: 'fragancia',
  uno_uno: 'armado',
  original: 'decant',
  producto: 'comprado',
};

/** El sustantivo con el que la ficha y el botón "+ Nuevo …" nombran cada línea. */
export const SUSTANTIVO_LINEA: Record<LineaCatalogo, string> = {
  contratipo: 'perfume',
  uno_uno: '1.1',
  original: 'original',
  producto: 'producto',
};
