import { DevolucionEstado, DevolucionMotivo, DevolucionSolucion } from '@prisma/client';
import { z } from 'zod/v4';

/**
 * Validación de devoluciones / reclamos de garantía. Siempre cuelgan de una
 * venta: es la única forma de saber qué plata sale y de dónde.
 *
 * El monto devuelto lo teclea el admin (puede ser parcial: se devuelve un
 * frasco de tres), pero nunca puede superar el valor de la venta — eso se
 * comprueba en el repositorio, que es quien conoce la venta.
 */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

/**
 * Los motivos, estados y soluciones NO se listan aquí: se leen del enum de
 * Prisma. Estaban copiados en tres sitios (el esquema, el router y el
 * `schema.prisma`), y tres copias de una lista terminan diciendo cosas
 * distintas el día que nazca un motivo nuevo.
 */

/** Unidades que vuelven de una fragancia concreta de la venta. */
const lineaSchema = z.object({
  perfume_id: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(999),
});

export const devolucionSchema = z
  .object({
    venta_id: z.number().int().positive('Elige la venta a la que pertenece'),
    fecha,
    motivo: z.enum(DevolucionMotivo),
    detalle: z.string().max(2000).nullish(),
    estado: z.enum(DevolucionEstado).default('pendiente'),
    solucion: z.enum(DevolucionSolucion).nullish(),
    monto_devuelto: z.number().min(0, 'No puede ser negativo').default(0),
    fecha_resolucion: fecha.nullish(),
    notas: z.string().max(2000).nullish(),
    /// Qué repusiste: tamaño y unidades. Sirve para valorar la pérdida al COSTO
    /// de producción, no al precio de venta (esa plata ya la cobraste).
    reposicion_formula_id: z.number().int().positive().nullish(),
    reposicion_cantidad: z.number().int().min(0).max(999).default(0),
    /// Costo de producir lo repuesto. Lo calcula el FRONT con el mismo motor puro
    /// del módulo de costos y aquí se congela — mismo criterio que el desglose de
    /// una cotización. Ojo: NO descuenta inventario, porque el material ya salió
    /// cuando se registró la producción de ese frasco; contarlo dos veces
    /// duplicaría la pérdida.
    costo_reposicion: z.number().min(0).default(0),
    /// Envío de la garantía: por ley lo asume el vendedor (art. 11).
    costo_envio: z.number().min(0).default(0),
  /**
   * ¿El cliente devolvió el producto y sirve para volver a venderse?
   *
   * Las dos por separado porque son dos hechos distintos: un frasco puede
   * volver a tu casa y no volver a tu inventario. Lo decide el dueño al
   * resolver, no el motivo del reclamo.
   */
  producto_devuelto: z.boolean().optional(),
  revendible: z.boolean().optional(),
    perfumes: z.array(lineaSchema).max(50).default([]),
  })
  .superRefine((v, ctx) => {
    // Un caso resuelto sin decir QUÉ se hizo deja el histórico inservible.
    if (v.estado === 'resuelta' && !v.solucion) {
      ctx.addIssue({
        code: 'custom', path: ['solucion'],
        message: 'Di qué hiciste: repusiste el producto o devolviste el dinero',
      });
    }
    // Plata devuelta sin marcar la solución = el ingreso del mes queda mal.
    if (v.monto_devuelto > 0 && v.solucion !== 'devolucion_dinero') {
      ctx.addIssue({
        code: 'custom', path: ['monto_devuelto'],
        message: 'Solo se registra plata devuelta cuando la solución es "devolución del dinero"',
      });
    }
    if (v.solucion === 'reposicion' && v.estado === 'resuelta' && !v.reposicion_formula_id) {
      ctx.addIssue({
        code: 'custom', path: ['reposicion_formula_id'],
        message: 'Di qué tamaño repusiste para poder calcular lo que te costó',
      });
    }
    if (v.solucion === 'devolucion_dinero' && v.estado === 'resuelta' && v.monto_devuelto <= 0) {
      ctx.addIssue({
        code: 'custom', path: ['monto_devuelto'],
        message: 'Escribe cuánto dinero le devolviste',
      });
    }
  });

/** Cambio rápido de estado desde la tabla (sin abrir el formulario). */
export const devolucionEstadoSchema = z.object({
  estado: z.enum(DevolucionEstado),
});

export type DevolucionInput = z.infer<typeof devolucionSchema>;
