import { z } from 'zod/v4';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

/**
 * Ajuste por conteo físico: dices cuánto TIENES de verdad y el sistema calcula
 * la diferencia. Es lo natural al contar el estante, y es como se siembra el
 * stock inicial (de 0 a lo que haya).
 */
export const ajusteSchema = z.object({
  insumo_id: z.number().int().positive(),
  cantidad_final: z.number().min(0, 'No puede ser negativa'),
  /**
   * Cuánto te costó esa unidad. Solo se usa si el ajuste SUMA material: al
   * sembrar el stock inicial es lo que evita que el promedio arranque torcido.
   */
  costo_unitario: z.number().min(0).optional(),
  /** Punto de pedido: en 0 se apaga la alerta. */
  stock_minimo: z.number().min(0).nullish(),

  fecha,
  nota: z.string().max(255).nullish(),
});

/**
 * Un lote armado. El frontend calcula qué se consume con el mismo motor puro
 * que ya usan las cotizaciones (`costeoCotizacion.ts`) y lo manda; aquí solo se
 * valida la forma y se aplica. Mismo criterio que créditos y cotizaciones:
 * la fórmula no se reimplementa en dos lenguajes.
 */
export const produccionSchema = z.object({
  fecha,
  formula_volumen_id: z.number().int().positive('Elige el tamaño que armaste'),
  /// Qué fragancia se armó: de ahí sale la esencia concreta que se descuenta.
  perfume_id: z.number().int().positive().nullish(),
  /// Envase realmente usado (el mismo tamaño puede llevar normal o luxury).
  envase_insumo_id: z.number().int().positive().nullish(),
  cantidad: z.number().int().min(1, 'Al menos una unidad').max(10000),
  consumos: z.array(z.object({
    insumo_id: z.number().int().positive(),
    /** Cantidad TOTAL del lote (ya multiplicada por las unidades). */
    cantidad: z.number().positive(),
  })).min(1, 'La fórmula no tiene insumos que descontar').max(40),
  nota: z.string().max(255).nullish(),
});

/**
 * Salida de material que NO es venta ni producción: rolones del mostrario,
 * minis de regalo, un frasco derramado. Se valora al costo promedio vigente.
 */
export const salidaSchema = z.object({
  insumo_id: z.number().int().positive(),
  cantidad: z.number().positive('¿Cuánto salió?'),
  unidad: z.enum(['ml', 'g', 'l', 'kg', 'unidad']).default('unidad'),
  motivo: z.enum(['muestra', 'merma']),
  fecha,
  nota: z.string().max(255).nullish(),
});

/**
 * Punto de pedido. `null` en un material lo devuelve a heredar el de su gama;
 * en una gama equivale a apagar la alerta de toda ella.
 */
export const minimoSchema = z.object({
  minimo: z.number().min(0).max(9_999_999).nullish(),
});

/**
 * Los puntos de pedido de VARIAS gamas de una sola vez.
 *
 * Se guardan juntos a propósito: son cuatro casillas de un mismo formulario y
 * el dueño las ajusta en una sentada. Una petición por casilla dejaba la
 * pantalla a medio guardar si una fallaba, y obligaba a volver a pedir la lista
 * cuatro veces.
 */
export const minimosGamasSchema = z.object({
  minimos: z.array(z.object({
    id: z.number().int().positive(),
    minimo: z.number().min(0).max(9_999_999),
  })).min(1, 'No mandaste ningún mínimo'),
});

export type SalidaInput = z.infer<typeof salidaSchema>;
export type AjusteInput = z.infer<typeof ajusteSchema>;
export type ProduccionInput = z.infer<typeof produccionSchema>;
