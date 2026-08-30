import { urls } from '../../../../infrastructure/api/urls';
import { useConsultaDeApoyo } from '../../../../application/hooks/useConsultaDeApoyo';
import { NoSePudoCargar } from '../../../../components/NoSePudoCargar';
import { Section } from '../../ui';
import { TarjetaLotePorEnlazar } from './TarjetaLotePorEnlazar';

export interface LotePorEnlazar {
  id: number; fecha: string; cantidad: number; formula_volumen_id: number;
  perfume_id: number | null; perfume_nombre: string | null;
  volumen_nombre: string; presentacion_id: number | null; costo_unitario: number;
  envase_insumo_id: number | null; envase_nombre: string | null;
  consumos: { insumo_id: number; cantidad: number }[];
  motivo: 'sin_frascos' | 'envase_ajeno';
  ficha_sugerida: { id: number; nombre: string } | null;
  /** Talla y precios con los que nacería la ficha 1.1 (ver la tarjeta). */
  talla_nombre: string | null;
  precio_lista_11: number | null;
  precio_heredado: number;
  categoria_11: string | null;
}

interface Props {
  /** Fichas que ya existen, para el camino alternativo de cada tarjeta. */
  perfumes: { id: number; nombre: string }[];
  /** Recargar la tabla y las métricas cuando uno se resuelve. */
  onResuelto: () => void;
}

/**
 * Los lotes 1.1 cuyos frascos quedaron en el sitio equivocado, o no quedaron.
 *
 * No tiene motor propio: todo acaba en corregir el lote apuntándolo a su ficha
 * —el mismo `PATCH` del lápiz—, creándola antes si hace falta. Un tercer camino
 * para mover frascos sería una tercera versión de la misma regla.
 */
export function LotesPorEnlazar({ perfumes, onResuelto }: Props) {
  const { dato, fallo, cargando, recargar: cargar } =
    useConsultaDeApoyo<LotePorEnlazar[]>(urls.inventario.produccionesPorEnlazar);
  const lotes = dato ?? [];

  const resuelto = () => { cargar(); onResuelto(); };

  if (cargando) return null;

  /**
   * NO PODER PREGUNTAR NO ES LO MISMO QUE NO TENER NADA (2026-08-29).
   *
   * Antes esta sección se escondía igual en los dos casos, "porque es
   * información de apoyo". Eso hizo invisible durante días un despliegue a
   * medias: el servidor respondía error por una columna que faltaba, el dueño
   * veía una pantalla normal sin aviso y concluyó que la función estaba mal
   * hecha. Una sección puede callarse cuando no hay nada que decir; nunca
   * cuando no pudo enterarse.
   */
  if (fallo) {
    return <Section><NoSePudoCargar que="si hay lotes por enlazar" onReintentar={cargar} /></Section>;
  }

  // La sección desaparece sola cuando no queda ninguno, como "Frascos ya armados".
  if (lotes.length === 0) return null;

  return (
    <Section>
      <p className="text-[13px] font-semibold text-amber-700">
        ⚠ {lotes.length} {lotes.length === 1 ? 'lote por enlazar' : 'lotes por enlazar'}
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        Son frascos 1.1 que armaste y que el sistema no tiene en su ficha propia. Cada botón crea
        esa ficha copiando la del perfume corriente y le mete los frascos, sin descontar esencia.
      </p>

      <ul className="mt-2 space-y-2.5">
        {lotes.map((l) => (
          <TarjetaLotePorEnlazar key={l.id} lote={l} perfumes={perfumes} onResuelto={resuelto} />
        ))}
      </ul>
    </Section>
  );
}
