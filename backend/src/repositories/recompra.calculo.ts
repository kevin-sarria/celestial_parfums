/**
 * RECOMPRA: a qué cliente ya se le debería estar acabando el perfume.
 *
 * Decisión del dueño (2026-09-28): no hay un número fijo —"a unos les dura 1
 * semana y a otros 3 meses porque casi no se aplican"—, así que el ritmo sale
 * de **las fechas de compra de cada cliente**: la mediana de los días entre
 * una compra y la siguiente. A quien compró una sola vez se le pone el **punto
 * medio**: la mediana de los ritmos de los que sí repiten.
 *
 * Mediana y no promedio: un cliente que compró dos veces la misma semana (una
 * para un amigo) no debe partirle el ritmo a la mitad.
 *
 * Aritmética pura, sin base de datos (la consulta vive en `recompra.ts`).
 */

export interface Compra {
  /** Quién: `u:<id>` si la venta está enlazada a un cliente, si no `n:<nombre normalizado>`. */
  clave: string;
  nombre: string;
  /** 'AAAA-MM-DD' */
  dia: string;
  referencia: string;
}

export type EstadoRecompra = 'le_toca' | 'pronto' | 'al_dia' | 'dormido';

/** Días antes de la fecha estimada en que ya se avisa como "pronto". */
export const DIAS_PRONTO = 7;
/** Sin clientes que repitan no hay de dónde sacar el punto medio: se usa este. */
export const RITMO_SIN_DATOS = 30;

const DIA_MS = 86_400_000;
const aDias = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DIA_MS;
const aTexto = (dias: number) => {
  const d = new Date(dias * DIA_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

export const mediana = (xs: number[]) => {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * - **le_toca**: ya pasó su fecha estimada, pero hace menos de un ciclo más.
 * - **pronto**: le toca en los próximos 7 días.
 * - **dormido**: pasó más de un ciclo entero de su fecha sin volver: ya no es
 *   "se le acabó", es "dejó de comprar" (otro mensaje).
 * - **al_dia**: todavía le queda.
 */
const estadoDe = (diasPara: number, ritmo: number): EstadoRecompra => {
  if (diasPara < -ritmo) return 'dormido';
  if (diasPara <= 0) return 'le_toca';
  if (diasPara <= DIAS_PRONTO) return 'pronto';
  return 'al_dia';
};

export const calcularRecompra = (compras: Compra[], hoy: string) => {
  const porCliente = new Map<string, Compra[]>();
  compras.forEach((c) => porCliente.set(c.clave, [...(porCliente.get(c.clave) ?? []), c]));

  const clientes = [...porCliente.entries()].map(([clave, cs]) => {
    const ordenadas = [...cs].sort((a, b) => a.dia.localeCompare(b.dia));
    // Varias ventas el mismo día son UNA compra
    const dias = [...new Set(ordenadas.map((c) => aDias(c.dia)))];
    const intervalos = dias.slice(1).map((d, i) => d - dias[i]);
    const ultima = ordenadas[ordenadas.length - 1];
    return { clave, nombre: ultima.nombre, dias, intervalos, ultima };
  });

  const ritmosPropios = clientes.map((c) => mediana(c.intervalos)).filter((r): r is number => r != null);
  const puntoMedio = Math.round(mediana(ritmosPropios) ?? RITMO_SIN_DATOS);
  const hoyDias = aDias(hoy);

  const filas = clientes.map((c) => {
    const propio = mediana(c.intervalos);
    const ritmo = Math.max(1, Math.round(propio ?? puntoMedio));
    const ultimaDias = c.dias[c.dias.length - 1];
    const proxima = ultimaDias + ritmo;
    const diasPara = proxima - hoyDias;
    return {
      clave: c.clave,
      nombre: c.nombre,
      compras: c.dias.length,
      primera: aTexto(c.dias[0]),
      ultima: aTexto(ultimaDias),
      ultima_referencia: c.ultima.referencia,
      ritmo_dias: ritmo,
      /** false = compró una sola vez: el ritmo es el punto medio de los demás. */
      ritmo_propio: propio != null,
      proxima: aTexto(proxima),
      /** Negativo = ya le tocaba hace tantos días. */
      dias_para: diasPara,
      estado: estadoDe(diasPara, ritmo),
    };
  });

  const ORDEN: Record<EstadoRecompra, number> = { le_toca: 0, pronto: 1, dormido: 2, al_dia: 3 };
  // Dentro de cada grupo, primero los más cercanos a su fecha: a quien le tocó
  // hace 2 días es más probable que vuelva que a quien le tocó hace dos meses
  filas.sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || Math.abs(a.dias_para) - Math.abs(b.dias_para));

  const cuenta = (e: EstadoRecompra) => filas.filter((f) => f.estado === e).length;
  return {
    hoy,
    punto_medio_dias: puntoMedio,
    clientes_que_repiten: ritmosPropios.length,
    resumen: { le_toca: cuenta('le_toca'), pronto: cuenta('pronto'), dormido: cuenta('dormido'), al_dia: cuenta('al_dia') },
    clientes: filas,
  };
};
