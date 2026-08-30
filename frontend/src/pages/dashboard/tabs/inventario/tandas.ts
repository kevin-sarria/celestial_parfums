/**
 * UNA TANDA MACERANDO, tal como la devuelve el servidor.
 *
 * Vive aparte porque la usan tres pantallas —el modal de envasar, la sección de
 * Producciones y la métrica de Inventario— y una copia del tipo en cada una
 * acabaría desincronizada la primera vez que el servidor agregue un campo.
 */
export interface Tanda {
  id: number;
  fecha: string;
  perfume_id: number;
  perfume_nombre: string;
  proporcion: string | null;
  ml_iniciales: number;
  /** Lo que queda por envasar. Puede ser negativo si se envasó de más. */
  saldo_ml: number;
  costo_ml: number;
  costo_total: number;
  /** Plata que hay hoy en ese frasco: es la métrica "Macerando". */
  valor_saldo: number;
  listo_estimado: string | null;
  cerrada_en: string | null;
  ml_merma: number | null;
  /** Días reposando: es el dato por el que se elige de cuál envasar. */
  dias: number;
  envasados: number;
  nota: string | null;
}
