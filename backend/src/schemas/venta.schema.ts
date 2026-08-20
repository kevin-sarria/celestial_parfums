import { z } from 'zod/v4';

export const createVentaSchema = z.object({
  dia: z.string().min(1, 'El día es obligatorio'),
  persona: z.string().min(1, 'La persona es obligatoria').max(150),
  // Enlace opcional con la persona registrada (usuario o ficha)
  user_id: z.number().int().positive().nullable().optional(),
  cantidad_perfumes: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  /**
   * Resumen de tallas. Dejó de ser obligatorio: la talla real vive en cada
   * línea (`lineas[].ml`) y este campo se deriva de ellas si llega vacío. Se
   * mantiene porque las 261 ventas históricas lo tienen y aún se muestra.
   */
  presentacion: z.string().max(100).optional().default(''),
  // Solo perfumes del catálogo: al menos uno (una venta de combo lleva varios)
  /**
   * Forma vieja: solo ids, sin talla. Se mantiene para no romper nada que ya
   * exista (importador, scripts) mientras el formulario migra a líneas.
   */
  perfume_ids: z.array(z.number().int().positive()).optional(),
  /**
   * Forma nueva: una línea por producto+talla. `ml` en null = producto sin
   * talla (una gorra) o venta histórica; esas no descuentan inventario porque
   * no se sabe qué receta aplicar.
   */
  lineas: z.array(z.object({
    perfume_id: z.number().int().positive(),
    ml: z.number().int().positive().nullish(),
    cantidad: z.number().int().min(1).max(999).default(1),
    /** Cuántas de esa cantidad van sin cobrar. Nunca mayor que la cantidad. */
    regalo: z.number().int().min(0).max(999).default(0),
  }).refine((l) => l.regalo <= l.cantidad, {
    message: 'El regalo no puede ser mayor que la cantidad',
    path: ['regalo'],
  })).optional(),
  valor_venta: z.number().positive('El valor debe ser mayor a 0'),
  // Es un dato EXTRA: se acepta texto, null o ausente
  datos_adicionales: z.string().max(5000).nullish(),
  // false = pendiente de pago (el código de descuento queda reservado, no canjeado)
  pagada: z.boolean().optional(),
  // Código único de descuento del pedido de WhatsApp (se canjea al pagar)
  codigo_descuento: z.string().max(20).nullish(),
})
  .superRefine((v, ctx) => {
    // Tiene que venir por una de las dos vías: líneas (nuevo) o ids (viejo)
    if (!v.lineas?.length && !v.perfume_ids?.length) {
      ctx.addIssue({
        code: 'custom', path: ['lineas'],
        message: 'Selecciona al menos un producto del catálogo',
      });
    }
  });

export type CreateVentaInput = z.infer<typeof createVentaSchema>;

/** Normaliza las dos formas de entrada a una sola lista de líneas. */
export const lineasDeVenta = (v: CreateVentaInput) => {
  if (v.lineas?.length) {
    // Se agrupa por producto+talla: dos Khamrah de 30 ml son UNA línea de 2.
    // El regalo se suma aparte: agrupar no puede romper `regalo <= cantidad`,
    // porque sumar dos pares que ya cumplen la desigualdad la sigue cumpliendo.
    const mapa = new Map<string, { perfume_id: number; ml: number | null; cantidad: number; regalo: number }>();
    for (const l of v.lineas) {
      const ml = l.ml ?? null;
      const clave = `${l.perfume_id}|${ml ?? ''}`;
      const previa = mapa.get(clave);
      if (previa) { previa.cantidad += l.cantidad; previa.regalo += l.regalo; }
      else mapa.set(clave, { perfume_id: l.perfume_id, ml, cantidad: l.cantidad, regalo: l.regalo });
    }
    return [...mapa.values()];
  }
  // Forma vieja: ids repetidos = unidades, sin talla (y nunca de regalo)
  const conteo = new Map<number, number>();
  for (const id of v.perfume_ids ?? []) conteo.set(id, (conteo.get(id) ?? 0) + 1);
  return [...conteo].map(([perfume_id, cantidad]) => ({ perfume_id, ml: null, cantidad, regalo: 0 }));
};
