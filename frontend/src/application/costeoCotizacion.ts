import type {
  AccesorioSeleccionado, DesgloseCosto, EscalaPrecio, FormulaVolumen, Insumo, Rentabilidad,
} from '../domain/entities/cotizacion.types';

/**
 * Motor de costeo del módulo mayorista. Funciones PURAS (sin fetch ni estado):
 * reciben los insumos y la fórmula, devuelven números. Al no depender de dónde
 * salen los datos, el día que exista un módulo de inventario basta con
 * alimentarlas desde ahí sin reescribir la lógica.
 *
 * Nada de esto se muestra al cliente: el desglose es información interna.
 */

/** Nombres con los que se identifican las materias primas base de la fórmula. */
export const MATERIA = {
  esencia: 'esencia',
  diluyente: 'diluyente',
  sellador: 'sellador',
  feromonas: 'feromonas',
} as const;

export type MateriaClave = keyof typeof MATERIA;

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Busca el precio por ml de una materia prima por su nombre (sin tildes ni
 * mayúsculas). Devuelve 0 si el admin todavía no la cargó: así el costeo nunca
 * revienta, solo muestra 0 y él ve que le falta ese insumo.
 */
const precioPorMl = (insumos: Insumo[], clave: MateriaClave): number => {
  const buscado = MATERIA[clave];
  const encontrado = insumos.find(
    (i) => i.tipo === 'materia_prima' && normalizar(i.nombre).includes(buscado),
  );
  return encontrado?.precio ?? 0;
};

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Mililitros de diluyente: el resto del volumen tras esencia, sellador y feromonas. */
export const mlDiluyente = (f: Pick<FormulaVolumen, 'ml_total' | 'esencia_ml' | 'sellador_ml' | 'feromonas_ml'>) =>
  Math.max(0, redondear(f.ml_total - f.esencia_ml - f.sellador_ml - f.feromonas_ml));

/**
 * Costo de producir UNA unidad: materias primas por ml + envase + accesorios.
 * `accesorios` son los extras marcados para esa línea (bolsa, perfumero, caja…).
 */
export const calcularDesgloseCosto = (
  formula: FormulaVolumen,
  insumos: Insumo[],
  accesorios: AccesorioSeleccionado[] = [],
): DesgloseCosto => {
  // La esencia se toma de la elegida en la receta (puede haber varias: normal,
  // premium…). Solo si no hay ninguna asignada se busca por nombre.
  const precioEsencia = formula.esencia_precio ?? precioPorMl(insumos, 'esencia');
  const esencia = redondear(formula.esencia_ml * precioEsencia);
  const diluyente = redondear(mlDiluyente(formula) * precioPorMl(insumos, 'diluyente'));
  const sellador = redondear(formula.sellador_ml * precioPorMl(insumos, 'sellador'));
  const feromonas = redondear(formula.feromonas_ml * precioPorMl(insumos, 'feromonas'));
  const envase = redondear(formula.envase_precio ?? 0);
  const accesoriosCosto = redondear(accesorios.reduce((s, a) => s + a.precio, 0));

  return {
    esencia,
    diluyente,
    sellador,
    feromonas,
    envase,
    accesorios: accesoriosCosto,
    costo_unitario: redondear(esencia + diluyente + sellador + feromonas + envase + accesoriosCosto),
  };
};

/**
 * Precio mayorista sugerido para una cantidad, según las escalas del tamaño.
 * El rango se evalúa por LÍNEA: cada producto según SU propia cantidad.
 * Devuelve null si no hay escala que cubra esa cantidad (el admin pone el precio).
 */
export const sugerirPrecio = (escalas: EscalaPrecio[], cantidad: number): number | null => {
  const aplica = escalas
    .filter((e) => cantidad >= e.cantidad_min && (e.cantidad_max == null || cantidad <= e.cantidad_max))
    // Ante rangos solapados gana el de mínimo más alto (el más específico).
    .sort((a, b) => b.cantidad_min - a.cantidad_min);
  return aplica[0]?.precio ?? null;
};

/** Rentabilidad de una línea: costo vs. lo que se cobra. */
export const rentabilidadLinea = (
  desglose: DesgloseCosto,
  precioUnitario: number,
  cantidad: number,
): Rentabilidad => {
  const costoTotal = redondear(desglose.costo_unitario * cantidad);
  const ingresoTotal = redondear(precioUnitario * cantidad);
  const utilidad = redondear(ingresoTotal - costoTotal);
  return {
    costoTotal,
    ingresoTotal,
    utilidad,
    margenPct: ingresoTotal > 0 ? redondear((utilidad / ingresoTotal) * 100) : 0,
  };
};

/** Rentabilidad total de la cotización, ya con el descuento global aplicado. */
export const rentabilidadTotal = (
  lineas: { desglose_costo: DesgloseCosto; precio_unitario: number; cantidad: number }[],
  descuentoPct = 0,
): Rentabilidad => {
  const costoTotal = redondear(
    lineas.reduce((s, l) => s + l.desglose_costo.costo_unitario * l.cantidad, 0),
  );
  const bruto = lineas.reduce((s, l) => s + l.precio_unitario * l.cantidad, 0);
  const ingresoTotal = Math.round(bruto * (1 - descuentoPct / 100));
  const utilidad = redondear(ingresoTotal - costoTotal);
  return {
    costoTotal,
    ingresoTotal,
    utilidad,
    margenPct: ingresoTotal > 0 ? redondear((utilidad / ingresoTotal) * 100) : 0,
  };
};
