import { useEffect, useState } from 'react';
import { Info, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import CostoDeProduccion from '../cotizacion/CostoDeProduccion';
import MargenPorFragancia from '../cotizacion/MargenPorFragancia';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import type { PromedioGama } from '../cotizacion/MargenPorGama';
import { EncabezadoPagina, Section } from '../ui';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

/**
 * Cuánto cuesta producir cada presentación, ya con los accesorios que la
 * acompañan. Aquí se decide qué lleva cada tamaño por defecto (bolsa,
 * perfumero, tarjeta…) y se ve al instante cómo cambia el costo y el margen.
 *
 * Es la vista que alimentará el futuro módulo de inventario: el costo unitario
 * por presentación sale de aquí y se recalcula solo al mover precios de insumos.
 */
export function CostosProduccionTab() {
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /**
   * Con qué gama de esencia se muestran los costos. Hace falta elegir porque la
   * receta ya no fija una fragancia: un 30 ml cuesta $9.277 con esencia clásica
   * y $28.106 con premium, así que "producir uno te cuesta X" a secas mentiría.
   */
  const [gamas, setGamas] = useState<PromedioGama[]>([]);
  const [gamaId, setGamaId] = useState<number | null>(null);

  const gamaElegida = gamas.find((g) => g.gama_id === gamaId) ?? gamas[0] ?? null;

  const load = async () => {
    setLoading(true);
    try {
      const [rf, ri, rp, rg] = await Promise.all([
        http.get<{ data?: FormulaVolumen[] }>(urls.costeo.formulas),
        http.get<{ data?: Insumo[] }>(urls.costeo.insumos),
        http.get<{ data?: Perfume[] | { data?: Perfume[] } }>(urls.perfumes.todos),
        http.get<{ data?: PromedioGama[] }>(urls.costeo.promediosPorGama),
      ]);
      if (rg.ok) {
        const gs = rg.cuerpo?.data ?? [];
        setGamas(gs);
        // Arranca en la gama con MÁS esencias: es la que representa lo que de
        // verdad se fabrica casi siempre.
        setGamaId((prev) => prev ?? gs.slice().sort((a, b) => b.esencias - a.esencias)[0]?.gama_id ?? null);
      }
      if (!rf.ok || !ri.ok) { setError(rf.error || ri.error); return; }
      setFormulas(rf.cuerpo?.data ?? []);
      setInsumos(ri.cuerpo?.data ?? []);
      // /api/parfums sin paginar responde { data: { data: [...] } }
      const jp = rp.cuerpo?.data;
      setPerfumes(Array.isArray(jp) ? jp : (jp?.data ?? []));
      setError('');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  /**
   * Guarda qué accesorios incluye este tamaño por defecto. La marca cambia al
   * instante (optimista) y se revierte sola si el guardado falla: así el costo
   * y los márgenes se ven de una, sin esperar al servidor.
   */
  const guardarAccesorios = async (formulaId: number, ids: number[]) => {
    const previas = formulas;
    setFormulas((prev) => prev.map((f) => (f.id === formulaId
      ? { ...f, accesorios_default: accesoriosDe(ids) }
      : f)));
    const res = await http.patch<{ data: FormulaVolumen }>(urls.costeo.accesoriosFormula(formulaId), {
      insumo_ids: ids,
    });
    if (!res.ok || !res.cuerpo) {
      setFormulas(previas);
      toast.error(res.error || 'No se pudo guardar los accesorios', { id: 'accesorios-formula' });
      return;
    }
    setFormulas((prev) => prev.map((f) => (f.id === formulaId ? res.cuerpo!.data : f)));
  };

  /** Convierte ids de insumo en el formato congelado que usa el costeo. */
  const accesoriosDe = (ids: number[]) => ids.flatMap((id) => {
    const i = insumos.find((x) => x.id === id);
    return i ? [{ insumo_id: i.id, nombre: i.nombre, precio: i.precio }] : [];
  });

  const porPedido = insumos.filter((i) => i.tipo === 'accesorio' && i.alcance === 'pedido');

  if (loading) return <Section><PerfumeSpinner /></Section>;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Costos de producción" count={formulas.length} />

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Cuánto te cuesta producir cada presentación, ya con los accesorios que la acompañan.
          Marca lo que lleva cada tamaño y el costo se recalcula al instante. Si mañana cambias
          de obsequio (una tarjeta en vez de la bolsa), solo lo marcas aquí.
        </span>
      </p>

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={() => load()}>Reintentar</Button>
        </p>
      )}

      {formulas.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Primero crea tus tamaños en "Tamaños y fórmulas".
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {gamas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
              <span className="text-[12.5px] text-muted-foreground">
                Costos con esencia
              </span>
              {gamas.map((g) => (
                <button
                  key={g.gama_id} type="button"
                  onClick={() => setGamaId(g.gama_id)}
                  className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                    g.gama_id === gamaId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g.gama} <span className="opacity-70">({formatPrice(g.promedio)}/ml)</span>
                </button>
              ))}
              <p className="w-full text-[12px] leading-snug text-muted-foreground">
                La receta dice cuánta esencia lleva, no cuál. Elige la gama para ver el costo
                real: la misma talla cuesta muy distinto con una clásica que con una premium.
              </p>
            </div>
          )}
          {formulas.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-[15px] font-medium text-foreground">{f.nombre}</p>
              <p className="text-[12.5px] text-muted-foreground">
                {f.ml_total} ml · esencia {f.esencia_ml} · diluyente {f.diluyente_ml}
                {f.envase_nombre && ` · ${f.envase_nombre}`}
              </p>
              <CostoDeProduccion
                formula={f}
                insumos={insumos}
                onAccesorios={(ids) => guardarAccesorios(f.id, ids)}
                abiertoPorDefecto
                esenciaPrecio={gamaElegida?.promedio ?? null}
                esenciaEtiqueta={gamaElegida?.gama}
              />
            </div>
          ))}
        </div>
      )}

      {/* Con precio de venta parejo, el margen lo decide la esencia de cada una */}
      <MargenPorFragancia perfumes={perfumes} formulas={formulas} insumos={insumos} />

      {/* Costos que van una sola vez por envío, no por perfume */}
      {porPedido.length > 0 && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
            <Package className="size-4 text-primary" /> Costos por pedido (no por perfume)
          </p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Estos se cobran una sola vez por envío, sin importar cuántos perfumes lleve.
            Se agregan al armar cada cotización.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {porPedido.map((i) => (
              <li key={i.id} className="rounded-full border border-border bg-card px-3 py-1 text-[12.5px]">
                {i.nombre} · <strong className="text-primary">{formatPrice(i.precio)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
