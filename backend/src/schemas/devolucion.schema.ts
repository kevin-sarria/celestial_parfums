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

export const MOTIVOS = [
  'llego_danado', 'llego_equivocado', 'llego_incompleto',
  'envase_defectuoso', 'no_llego', 'otro',
] as const;

export const ESTADOS = ['pendiente', 'en_revision', 'resuelta', 'rechazada'] as const;
export const SOLUCIONES = ['reposicion', 'devolucion_dinero', 'ninguna'] as const;

/** Unidades que vuelven de una fragancia concreta de la venta. */
const lineaSchema = z.object({
  perfume_id: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(999),
});

export const devolucionSchema = z
  .object({
    venta_id: z.number().int().positive('Elige la venta a la que pertenece'),
    fecha,
    motivo: z.enum(MOTIVOS),
    detalle: z.string().max(2000).nullish(),
    estado: z.enum(ESTADOS).default('pendiente'),
    solucion: z.enum(SOLUCIONES).nullish(),
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
  estado: z.enum(ESTADOS),
});

export type DevolucionInput = z.infer<typeof devolucionSchema>;
