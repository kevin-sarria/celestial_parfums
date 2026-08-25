import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Section } from '../../ui';

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
  /** Fichas a las que se puede mandar un lote. */
  perfumes: { id: number; nombre: string }[];
  /** Recargar la tabla y las métricas cuando uno se resuelve. */
  onResuelto: () => void;
}

/**
 * Los lotes cuyos frascos quedaron en el sitio equivocado, o no quedaron.
 *
 * No tiene motor propio: manda a la **carga inicial** (los que nunca entraron,
 * cuyo material ya se descontó hace semanas) o al **PATCH del lote** (los que
 * entraron en la ficha equivocada). Un tercer camino para mover frascos sería
 * una tercera versión de la misma regla.
 *
 * Al mudar frascos se reenvía el lote ENTERO —consumos, envase y costo
 * congelado— porque el PATCH lo valida completo: mandar solo la ficha nueva
 * rehacía el lote sin material, y dejar que el costo se recalculara revaluaría
 * los frascos al promedio de hoy. Mudar un frasco de ficha no puede cambiar lo
 * que costó.
 */
export function LotesPorEnlazar({ perfumes, onResuelto }: Props) {
  const [lotes, setLotes] = useState<LotePorEnlazar[]>([]);
  const [destinos, setDestinos] = useState<Record<number, number | ''>>({});
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<number | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: LotePorEnlazar[] }>(urls.inventario.produccionesPorEnlazar);
      if (!res.ok) throw new Error(res.error);
      const lista = res.cuerpo?.data ?? [];
      setLotes(lista);
      setDestinos(Object.fromEntries(lista.map((l) => [l.id, l.ficha_sugerida?.id ?? ''])));
    } catch {
      // Es información de apoyo: si no carga, la pantalla principal sigue
      // sirviendo y no tiene sentido alarmar con un error.
      setLotes([]);
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const resolver = async (lote: LotePorEnlazar) => {
    const destino = destinos[lote.id];
    if (!destino) { toast.error('Elige a qué ficha van estos frascos', { id: 'enlazar' }); return; }
    setEnviando(lote.id);
    try {
      const res = lote.motivo === 'sin_frascos'
        ? await http.post(urls.inventario.cargaInicialArmados, {
          fecha: lote.fecha,
          perfume_id: destino,
          presentacion_id: lote.presentacion_id,
          cantidad: lote.cantidad,
          costo_unitario: lote.costo_unitario,
          nota: `Lote #${lote.id}`,
        })
        : await http.patch(urls.inventario.produccion(lote.id), {
          fecha: lote.fecha,
          formula_volumen_id: lote.formula_volumen_id,
          cantidad: lote.cantidad,
          perfume_id: destino,
          envase_insumo_id: lote.envase_insumo_id,
          consumos: lote.consumos,
          costo_unitario: lote.costo_unitario,
          costo_manual: false,
        });
      if (!res.ok) { toast.error(res.error, { id: 'enlazar' }); return; }
      toast.success(lote.motivo === 'sin_frascos'
        ? `Listo: ${lote.cantidad} ${lote.cantidad === 1 ? 'frasco entró' : 'frascos entraron'} a su ficha, sin descontar esencia`
        : 'Listo: esos frascos ya están en su ficha, con su costo');
      await cargar();
      onResuelto();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'enlazar' }); }
    finally { setEnviando(null); }
  };

  // La sección desaparece sola cuando no queda ninguno, como "Frascos ya armados".
  if (cargando || lotes.length === 0) return null;

  return (
    <Section>
      <p className="text-[13px] font-semibold text-amber-700">
        ⚠ {lotes.length} {lotes.length === 1 ? 'lote por enlazar' : 'lotes por enlazar'}
      </p>

      <ul className="mt-2 space-y-2.5">
        {lotes.map((l) => (
          <li key={l.id} className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2.5">
            <p className="text-[13px] font-medium text-foreground">
              Lote {l.id} · {l.fecha} · {l.perfume_nombre} · {l.volumen_nombre} ·{' '}
              {l.cantidad} {l.cantidad === 1 ? 'unidad' : 'unidades'}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {l.motivo === 'sin_frascos'
                ? 'Descontó su material pero no dejó ningún frasco en el sistema: se registró antes de que existiera el libro de frascos armados. Sus frascos entran sin volver a descontar esencia.'
                : `Gastó "${l.envase_nombre}", pero sus frascos quedaron en la ficha del perfume corriente. Si alguien compra el normal, se le entrega este frasco.`}
            </p>

            {l.ficha_sugerida && (
              <p className="mt-0.5 text-[12.5px] text-foreground">
                Debería ir a <strong>{l.ficha_sugerida.nombre}</strong>, que es la ficha que usa ese envase.
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="w-64">
                <BuscadorSelect
                  value={destinos[l.id] ?? ''}
                  placeholder="— ¿A qué ficha van? —"
                  /* La ficha propuesta va SIEMPRE en la lista, aunque el
                     catálogo del dashboard —que se sirve cacheado— todavía no
                     la traiga: una ficha recién creada es justo el destino más
                     probable de un lote colgado. */
                  opciones={[
                    ...(l.ficha_sugerida && !perfumes.some((p) => p.id === l.ficha_sugerida!.id)
                      ? [{ id: l.ficha_sugerida.id as number | string, nombre: l.ficha_sugerida.nombre }]
                      : []),
                    ...perfumes.map((p) => ({ id: p.id as number | string, nombre: p.nombre })),
                  ]}
                  onSelect={(id) => setDestinos((prev) => ({ ...prev, [l.id]: id === '' ? '' : Number(id) }))}
                />
              </div>
              <Button size="sm" onClick={() => resolver(l)} disabled={enviando === l.id}>
                {l.motivo === 'sin_frascos' ? 'Sumar los frascos a su ficha' : 'Enlazar a su ficha'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
