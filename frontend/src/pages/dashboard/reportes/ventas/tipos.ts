/**
 * Lo que responde `/reportes/ventas?desde&hasta` (ver
 * `backend/src/repositories/reporteVentasRango.ts`).
 *
 * `null` en costo, ganancia y margen significa **"sin datos"**: el sistema no
 * registró el costo de esas ventas (antes de agosto de 2026 no se registraba).
 * Nunca es cero: un cero pintaría una ganancia del 100 %.
 */

export interface ResumenVentas {
  num_ventas: number;
  unidades: number;
  regalos: number;
  /** Solo lo pagado por completo (decisión del dueño, 2026-09-27). */
  vendido: number;
  ticket_promedio: number;
  en_deuda: number;
  num_en_deuda: number;
  unidades_en_deuda: number;
  costo: number | null;
  ganancia: number | null;
  margen_pct: number | null;
  sin_costo: { num: number; valor: number };
  /** Qué % de lo vendido tiene costo: por debajo de 100 la ganancia es parcial. */
  cobertura_pct: number | null;
}

export interface MesReporte {
  mes: string;
  unidades: number;
  vendido: number;
  en_deuda: number;
  costo: number | null;
  ganancia: number | null;
  margen_pct: number | null;
  sin_costo: number;
  cobertura_pct: number | null;
  invertido: number;
  perdidas: number;
}

export interface Perdidas {
  mermas: number;
  diferencias_conteo: number;
  garantias: number;
  dinero_devuelto: number;
  ventas_bajo_costo: number;
  detalle_bajo_costo: { id: number; dia: string; persona: string; valor: number; costo: number; perdida: number }[];
  total: number;
  muestras: number;
}

export interface ReporteVentasRango {
  desde: string;
  hasta: string;
  ventas: ResumenVentas;
  invertido: { num: number; compras: number; envios: number; total: number };
  perdidas: Perdidas;
  meses: MesReporte[];
  top_productos: { perfume_id: number; nombre: string; unidades: number }[];
  por_talla: { ml: number | null; unidades: number }[];
  /** Por categoría (contratipo, 1.1, original…) y "Accesorios"; de la que más vende a la que menos. */
  por_linea: (CifrasDeGrupo & { linea: string })[];
  /** Todas las fragancias vendidas, de la que más ganancia deja a la que menos (sin costo, al final). */
  por_fragancia: (CifrasDeGrupo & { perfume_id: number; nombre: string })[];
  /** Ventas que mezclaron líneas y se repartieron por precio de catálogo. */
  ventas_repartidas: number;
}

/** Lo vendido de una línea o de una fragancia (solo lo pagado por completo). */
export interface CifrasDeGrupo {
  unidades: number;
  vendido: number;
  costo: number | null;
  ganancia: number | null;
  margen_pct: number | null;
  cobertura_pct: number | null;
}

/** Por debajo de esta cobertura la ganancia se enseña como parcial. */
export const COBERTURA_COMPLETA = 100;
