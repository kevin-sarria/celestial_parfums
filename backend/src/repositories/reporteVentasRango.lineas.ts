/**
 * Ventas por LÍNEA (contratipo, 1.1, original, accesorios…) y por FRAGANCIA:
 * cuánto se vendió de cada una, cuánto costó y cuánto quedó.
 *
 * Pedido del dueño el 2026-09-28, al revisar el panel: el reporte mezclaba
 * todo y no dejaba ver si el 1.1 deja más o menos que el contratipo, ni qué
 * fragancia deja más plata (la más vendida no es siempre la que más deja).
 *
 * Aritmética pura, sin base de datos, con las MISMAS definiciones del resto
 * del reporte: solo cuenta lo **pagado por completo**, y la ganancia se mide
 * solo donde hay costo registrado (lo demás es "sin datos", nunca cero).
 *
 * **Cómo se reparte una venta.** La base guarda el valor y el costo de la
 * VENTA, no de cada línea. Si la venta es de un solo producto (o de varios de
 * la misma línea) no hay nada que repartir. Si mezcla, el valor y el costo se
 * reparten según el **precio de catálogo** de cada producto por las unidades
 * COBRADAS (un regalo no trae plata; su costo lo cargan las líneas cobradas).
 * Medido el 2026-09-28 en el respaldo de producción: de 319 ventas, UNA sola
 * mezcla categorías, así que por línea el reparto casi nunca entra en juego.
 */

export interface LineaDeVenta { perfume_id: number; cantidad: number; regalo: number }

export interface VentaConLineas {
  valor: number;
  /** 0 = sin costo registrado. */
  costo: number;
  pagada: boolean;
  lineas: LineaDeVenta[];
}

export interface FichaDeProducto {
  nombre: string;
  /** La línea a la que suma: su categoría, o "Accesorios". */
  linea: string;
  /** Precio de catálogo: solo sirve para repartir una venta mixta. */
  precio: number;
}

/** Las ventas viejas que no se enlazaron a ningún producto del catálogo. */
export const SIN_IDENTIFICAR = 'Sin identificar';

const r2 = (n: number) => Math.round(n * 100) / 100;

interface Acumulado { unidades: number; vendido: number; vendidoConCosto: number; costo: number }
const nuevo = (): Acumulado => ({ unidades: 0, vendido: 0, vendidoConCosto: 0, costo: 0 });

const cerrar = (a: Acumulado) => {
  const hayCosto = a.vendidoConCosto > 0;
  const ganancia = hayCosto ? r2(a.vendidoConCosto - a.costo) : null;
  return {
    unidades: a.unidades,
    vendido: r2(a.vendido),
    costo: hayCosto ? r2(a.costo) : null,
    ganancia,
    margen_pct: ganancia != null ? Math.round((ganancia / a.vendidoConCosto) * 1000) / 10 : null,
    /** Qué % de lo vendido tiene costo: por debajo de 100 la ganancia es parcial. */
    cobertura_pct: a.vendido > 0 ? Math.round((a.vendidoConCosto / a.vendido) * 100) : null,
  };
};

export const repartirPorLineaYFragancia = (ventas: VentaConLineas[], fichas: Map<number, FichaDeProducto>) => {
  const porLinea = new Map<string, Acumulado>();
  const porFragancia = new Map<number, Acumulado>();
  const sumar = <K>(m: Map<K, Acumulado>, k: K, unidades: number, parte: number, v: VentaConLineas) => {
    const a = m.get(k) ?? nuevo();
    a.unidades += unidades;
    a.vendido += v.valor * parte;
    if (v.costo > 0) {
      a.vendidoConCosto += v.valor * parte;
      a.costo += v.costo * parte;
    }
    m.set(k, a);
  };

  let mixtas = 0;
  for (const v of ventas) {
    if (!v.pagada) continue;
    if (v.lineas.length === 0) {
      sumar(porLinea, SIN_IDENTIFICAR, 0, 1, v);
      continue;
    }
    // Peso de cada línea: precio × unidades cobradas. Si no hay con qué
    // pesar (todo regalo, o productos sin precio), se reparte por unidades.
    const pesos = v.lineas.map((l) => (fichas.get(l.perfume_id)?.precio ?? 0) * Math.max(0, l.cantidad - l.regalo));
    const total = pesos.reduce((s, p) => s + p, 0);
    const unidadesVenta = v.lineas.reduce((s, l) => s + l.cantidad, 0);
    const parteDe = (i: number) => (total > 0 ? pesos[i] / total : v.lineas[i].cantidad / (unidadesVenta || 1));

    const lineasDeLaVenta = new Set(v.lineas.map((l) => fichas.get(l.perfume_id)?.linea ?? SIN_IDENTIFICAR));
    if (lineasDeLaVenta.size > 1) mixtas += 1;

    v.lineas.forEach((l, i) => {
      const linea = fichas.get(l.perfume_id)?.linea ?? SIN_IDENTIFICAR;
      sumar(porLinea, linea, l.cantidad, parteDe(i), v);
      sumar(porFragancia, l.perfume_id, l.cantidad, parteDe(i), v);
    });
  }

  return {
    por_linea: [...porLinea.entries()]
      .map(([linea, a]) => ({ linea, ...cerrar(a) }))
      .sort((a, b) => b.vendido - a.vendido),
    /** Primero las que más dejan; las que no tienen costo van al final, por lo vendido. */
    por_fragancia: [...porFragancia.entries()]
      .map(([perfume_id, a]) => ({ perfume_id, nombre: fichas.get(perfume_id)?.nombre ?? `#${perfume_id}`, ...cerrar(a) }))
      .sort((a, b) => (b.ganancia ?? -Infinity) - (a.ganancia ?? -Infinity) || b.vendido - a.vendido),
    /** Cuántas ventas mezclaron líneas y se repartieron por precio de catálogo. */
    ventas_repartidas: mixtas,
  };
};
