import type { ResumenVentas } from '../../reportes/ventas/tipos';

/**
 * Lo que responde `/reportes/inicio` (ver
 * `backend/src/repositories/inicio.repository.ts`). Cada bloque sale de la
 * misma función que la pantalla que lo detalla.
 */

export type TonoPendiente = 'urgente' | 'aviso' | 'info';

export interface Pendiente {
  id: string;
  texto: string;
  /** Pestaña donde se resuelve; '' = no navega (el respaldo). */
  tab: string;
  tono: TonoPendiente;
}

export interface Frasco11 {
  perfume_id: number;
  nombre: string;
  armados: number;
  /** Unidades vendidas en los últimos `dias` días. */
  vendidos: number;
}

export interface EsenciaPorAcabarse {
  id: number;
  nombre: string;
  stock: number;
  unidad: string;
  /** Días que alcanza al ritmo de los últimos 90; null = no se está gastando. */
  dias_restantes: number | null;
}

export interface VentaReciente {
  id: number;
  dia: string;
  persona: string;
  valor_venta: number;
  pagada: boolean;
  referencia_perfume: string;
}

export interface ResumenInicio {
  hoy: string;
  mes: { desde: string; hasta: string; ventas: ResumenVentas; invertido: number };
  /** El mes anterior HASTA EL MISMO DÍA, para comparar parejo. */
  anterior: { desde: string; hasta: string; ventas: ResumenVentas };
  cartera: {
    total_en_deuda: number;
    clientes_con_deuda: number;
    vencido: number;
    creditos_vencidos: number;
    abonado_mes: number;
  };
  pendientes: Pendiente[];
  frascos_11: { total_armados: number; referencias: number; sin_armar: Frasco11[]; dias: number };
  esencias: { total: number; filas: EsenciaPorAcabarse[] };
  ultimas_ventas: VentaReciente[];
}
