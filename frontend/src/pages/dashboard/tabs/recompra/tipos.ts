/** Lo que responde `/reportes/recompra` (ver `backend/src/repositories/recompra.calculo.ts`). */

export type EstadoRecompra = 'le_toca' | 'pronto' | 'al_dia' | 'dormido';

export interface ClienteRecompra {
  clave: string;
  nombre: string;
  /** Teléfono de su ficha. null = la venta no está enlazada, o la ficha no lo tiene. */
  telefono: string | null;
  compras: number;
  primera: string;
  ultima: string;
  ultima_referencia: string;
  ritmo_dias: number;
  /** false = compró una sola vez: su ritmo es el punto medio de los que repiten. */
  ritmo_propio: boolean;
  proxima: string;
  /** Negativo = ya le tocaba hace tantos días. */
  dias_para: number;
  estado: EstadoRecompra;
}

export interface ResumenRecompra { le_toca: number; pronto: number; dormido: number; al_dia: number }

export interface ListaRecompra {
  hoy: string;
  punto_medio_dias: number;
  clientes_que_repiten: number;
  resumen: ResumenRecompra;
  clientes: ClienteRecompra[];
}
