import { z } from 'zod/v4';

/**
 * Validación del módulo de cotizaciones mayoristas. El desglose de costos lo
 * calcula el frontend (motor puro `costeoCotizacion.ts`) y aquí solo se valida
 * su FORMA y rangos: el backend lo guarda tal cual, igual que la deuda de un
 * crédito. Así una cotización vieja conserva su rentabilidad histórica aunque
 * mañana suban los precios de los insumos.
 */

const dinero = z.number().min(0, 'No puede ser negativo');
const mililitros = z.number().min(0);

// ── Insumos ─────────────────────────────────────────────────────────────────
export const insumoSchema = z.object({
  nombre: z.string().min(1, 'Ponle un nombre al insumo').max(120),
  tipo: z.enum(['materia_prima', 'envase', 'accesorio']),
  unidad: z.enum(['ml', 'unidad']),
  /// unidad = uno por perfume; pedido = uno por envío completo.
  alcance: z.enum(['unidad', 'pedido']).default('unidad'),
  precio: dinero,
  activo: z.boolean().optional(),
  /**
   * Gama de la esencia (clásica, árabe, premium, diseñador… es una tabla que el
   * dueño puede ampliar). Solo aplica a esencias: un frasco o el diluyente van
   * en null. Se usa para costear cuando todavía no se sabe qué fragancia va.
   */
  gama_id: z.number().int().positive().nullish(),
  /** Para quién es la fragancia de esta esencia. Solo aplica a esencias. */
  genero: z.enum(['dama', 'caballero', 'unisex']).nullish(),
  /**
   * Crear también, de una vez, el producto del catálogo que se arma con esta
   * esencia. Solo tiene sentido en esencias: un frasco no es un perfume.
   *
   * Nace del momento REAL en que el negocio se entera de que existe una
   * fragancia nueva: cuando llega en una compra. Enlazar ahí la esencia con su
   * perfume deja lista toda la cadena —esencia → perfume → receta → descuento
   * al vender— sin depender de que alguien se acuerde de hacerlo después.
   */
  crear_perfume: z.boolean().optional(),
  /** Nombre de la fragancia, sin el "– Esencia". Es el que verá el cliente. */
  perfume_nombre: z.string().max(150).optional(),
  /**
   * Solo para `tipo: 'accesorio'` con `crear_perfume`: a cuánto se le vende al
   * cliente. Va aparte de `precio` a propósito — ese es lo que CUESTA, y este
   * lo que se COBRA. Confundirlos es vender a precio de costo sin darse cuenta.
   */
  precio_venta: z.number().nonnegative().optional(),
});

/** Accesorios que un tamaño incluye por defecto. */
export const accesoriosFormulaSchema = z.object({
  insumo_ids: z.array(z.number().int().positive()).max(20),
});

// ── Fórmulas por volumen ────────────────────────────────────────────────────
export const formulaSchema = z
  .object({
    nombre: z.string().min(1, 'Ponle un nombre (ej: 30 ml)').max(60),
    ml_total: z.number().int().min(1, 'El volumen debe ser mayor a 0'),
    esencia_ml: mililitros,
    sellador_ml: mililitros,
    feromonas_ml: mililitros,
    envase_insumo_id: z.number().int().positive().nullable(),
    /// Qué esencia usa esta receta (normal, premium…). Null = se busca por nombre.
    esencia_insumo_id: z.number().int().positive().nullable().optional(),
    activo: z.boolean().optional(),
    orden: z.number().int().optional(),
  })
  // El diluyente es el resto: si los componentes se pasan del total, la fórmula
  // es imposible de fabricar y hay que avisarlo aquí, no al calcular el costo.
  .refine((f) => f.esencia_ml + f.sellador_ml + f.feromonas_ml <= f.ml_total, {
    message: 'La suma de esencia, sellador y feromonas supera el volumen total',
    path: ['esencia_ml'],
  });

// ── Escalas de precio mayorista ─────────────────────────────────────────────
export const escalaSchema = z
  .object({
    formula_volumen_id: z.number().int().positive(),
    cantidad_min: z.number().int().min(1),
    cantidad_max: z.number().int().min(1).nullable(),
    precio: dinero,
  })
  .refine((e) => e.cantidad_max == null || e.cantidad_max >= e.cantidad_min, {
    message: 'La cantidad máxima no puede ser menor que la mínima',
    path: ['cantidad_max'],
  });

// ── Config global (textos y valores por defecto) ────────────────────────────
export const condicionesSchema = z.object({
  pedido_minimo: z.string().max(300).default(''),
  tiempo_preparacion: z.string().max(300).default(''),
  tiempo_despacho: z.string().max(300).default(''),
  forma_pago: z.string().max(300).default(''),
  condiciones_pago: z.string().max(500).default(''),
  costos_envio: z.string().max(300).default(''),
  garantias: z.string().max(500).default(''),
  politica_cambios: z.string().max(500).default(''),
});

export const cotizacionConfigSchema = z.object({
  vigencia_dias_default: z.number().int().min(1).max(365),
  condiciones_comerciales: condicionesSchema,
  beneficios_items: z.array(z.string().max(300)).max(20),
  avisos_legales: z.array(z.string().max(600)).max(20),
});

// ── Plantillas comerciales ──────────────────────────────────────────────────
export const plantillaSchema = z.object({
  nombre: z.string().min(1, 'Ponle un nombre a la plantilla').max(80),
  descuento_pct: z.number().min(0).max(100),
  condiciones_comerciales: condicionesSchema.nullable().optional(),
  observaciones_default: z.string().max(2000).nullable().optional(),
  activo: z.boolean().optional(),
});

// ── Cotización ──────────────────────────────────────────────────────────────
/** Desglose interno por unidad; solo lo ve el admin, nunca el PDF del cliente. */
const desgloseSchema = z.object({
  esencia: dinero,
  diluyente: dinero,
  sellador: dinero,
  feromonas: dinero,
  envase: dinero,
  accesorios: dinero,
  costo_unitario: dinero,
});

const itemSchema = z.object({
  perfume_id: z.number().int().positive().nullable(),
  perfume_nombre: z.string().min(1).max(150),
  formula_volumen_id: z.number().int().positive().nullable(),
  volumen_nombre: z.string().min(1).max(60),
  cantidad: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  accesorios_seleccionados: z.array(
    z.object({
      insumo_id: z.number().int().positive(),
      nombre: z.string().max(120),
      precio: dinero,
    }),
  ),
  desglose_costo: desgloseSchema,
  precio_unitario: dinero,
  subtotal: dinero,
});

/** Lista de precios congelada de una cotización general. */
const listaPreciosSchema = z.array(
  z.object({
    volumen_nombre: z.string().max(60),
    escalas: z.array(
      z.object({
        desde: z.number().int().min(1),
        hasta: z.number().int().nullable(),
        precio: dinero,
      }),
    ),
  }),
);

const insumoElegidoSchema = z.object({
  insumo_id: z.number().int().positive(),
  nombre: z.string().max(120),
  precio: dinero,
});

export const cotizacionSchema = z.object({
  tipo: z.enum(['general', 'detallada']).default('detallada'),
  lista_precios: listaPreciosSchema.nullable().optional(),
  /// Insumos de alcance "pedido" (caja de envío…): se cobran una sola vez.
  extras_pedido: z.array(insumoElegidoSchema).default([]),
  cliente_nombre: z.string().min(1, 'El nombre del cliente es obligatorio').max(150),
  cliente_empresa: z.string().max(150).nullable().optional(),
  cliente_telefono: z.string().max(30).nullable().optional(),
  cliente_email: z.string().max(150).nullable().optional(),
  cliente_nit: z.string().max(50).nullable().optional(),
  plantilla_id: z.number().int().positive().nullable().optional(),
  descuento_pct: z.number().min(0).max(100),
  vigencia_dias: z.number().int().min(1).max(365),
  condiciones_comerciales: condicionesSchema,
  observaciones: z.string().max(2000).nullable().optional(),
  estado: z.enum(['borrador', 'enviada']).optional(),
  items: z.array(itemSchema).default([]),
})
  // Una general lleva lista de precios; una detallada, productos. Sin eso el
  // documento saldría vacío y no tendría nada que mostrarle al cliente.
  // superRefine (no refine) para poder dar un mensaje distinto según el tipo:
  // un "Invalid input" genérico no le dice al usuario qué corregir.
  .superRefine((c, ctx) => {
    if (c.tipo === 'general' && (c.lista_precios?.length ?? 0) === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['lista_precios'],
        message: 'Elige al menos un tamaño con precios por cantidad',
      });
    }
    if (c.tipo === 'detallada' && c.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Agrega al menos un producto' });
    }
  });

/** Alta y edición de una gama de esencia. */
export const gamaSchema = z.object({
  nombre: z.string().min(1, 'Ponle un nombre a la gama').max(60),
  orden: z.number().int().min(0).max(999).default(0),
});

export type InsumoInput = z.infer<typeof insumoSchema>;
export type GamaInput = z.infer<typeof gamaSchema>;
export type FormulaInput = z.infer<typeof formulaSchema>;
export type EscalaInput = z.infer<typeof escalaSchema>;
export type CotizacionConfigInput = z.infer<typeof cotizacionConfigSchema>;
export type PlantillaInput = z.infer<typeof plantillaSchema>;
export type CotizacionInput = z.infer<typeof cotizacionSchema>;
export type CondicionesComerciales = z.infer<typeof condicionesSchema>;
