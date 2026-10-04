import { etiquetaTalla } from '../../../../domain/entities/linea';
import { cumpleMeta, ganancia, precioSugerido, type Meta } from './sugerencia';

/** Lo que devuelve `GET /api/precios-originales`. */
export interface Desglose { liquido: number; merma: number; frasco: number; empaque: number; total: number }
export interface TallaOriginal {
  presentacion_id: number; nombre: string; ml: number; botella_completa: boolean;
  costo: Desglose | null; precio: number; propio: boolean;
}
export interface Original {
  id: number; nombre: string; publicado: boolean; ml_botella: number | null;
  meta: Meta | null; tallas: TallaOriginal[];
}

export type Estado = 'Sin precio' | 'Bajo tu meta' | 'Al día' | 'Sin costo';
export const ESTADOS: readonly Estado[] = ['Sin precio', 'Bajo tu meta', 'Al día', 'Sin costo'];

/** Una fila de la tabla: UNA talla de UN original (2026-10-04, rediseño). */
export interface FilaPrecio {
  clave: string;
  perfume_id: number;
  perfume: string;
  publicado: boolean;
  presentacion_id: number;
  talla: string;
  ml: number;
  costo: Desglose | null;
  precio: number;
  sugerido: number | null;
  ganancia: { pesos: number; porcentaje: number } | null;
  estado: Estado;
  /** La meta con que se sugiere: la propia del perfume o la general. */
  meta: Meta;
  metaPropia: Meta | null;
}

const estadoDe = (precio: number, costo: number | null, meta: Meta): Estado => {
  if (costo == null) return 'Sin costo';
  if (precio <= 0) return 'Sin precio';
  return cumpleMeta(precio, costo, meta) ? 'Al día' : 'Bajo tu meta';
};

/** Aplana los originales en filas, con su sugerido y su estado según la meta que les toca. */
export const filasDePrecios = (originales: Original[], metaGeneral: Meta): FilaPrecio[] =>
  originales.flatMap(o => o.tallas.map(t => {
    const meta = o.meta ?? metaGeneral;
    const costo = t.costo?.total ?? null;
    return {
      clave: `${o.id}-${t.presentacion_id}`,
      perfume_id: o.id,
      perfume: o.nombre,
      publicado: o.publicado,
      presentacion_id: t.presentacion_id,
      talla: etiquetaTalla('original', { presentacion: t.nombre, ml: t.ml, botella_completa: t.botella_completa }),
      ml: t.ml,
      costo: t.costo,
      precio: t.precio,
      sugerido: precioSugerido(costo, meta),
      ganancia: ganancia(t.precio, costo),
      estado: estadoDe(t.precio, costo, meta),
      meta,
      metaPropia: o.meta,
    };
  }));

/** ¿Tiene sentido "Usar" el sugerido? Solo si hay uno y es distinto del de hoy. */
export const cambiaConSugerido = (f: FilaPrecio) => f.sugerido != null && f.sugerido !== f.precio;

/** El sugerido BAJA un precio que ya vende: de a uno y a conciencia, nunca en bloque. */
export const bajaPrecio = (f: FilaPrecio) => f.precio > 0 && f.sugerido != null && f.sugerido < f.precio;

/** Lo que el botón en bloque sí toca: lo que no tiene precio y lo que sube. */
export const aplicableEnBloque = (f: FilaPrecio) => cambiaConSugerido(f) && !bajaPrecio(f);
