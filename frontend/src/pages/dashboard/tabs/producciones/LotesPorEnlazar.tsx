import { useEffect, useState } from 'react';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
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
  const [lotes, setLotes] = useState<LotePorEnlazar[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: LotePorEnlazar[] }>(urls.inventario.produccionesPorEnlazar);
      if (!res.ok) throw new Error(res.error);
      setLotes(res.cuerpo?.data ?? []);
    } catch {
      // Es información de apoyo: si no carga, la pantalla principal sigue
      // sirviendo y no tiene sentido alarmar con un error.
      setLotes([]);
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const resuelto = () => { cargar(); onResuelto(); };

  // La sección desaparece sola cuando no queda ninguno, como "Frascos ya armados".
  if (cargando || lotes.length === 0) return null;

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
