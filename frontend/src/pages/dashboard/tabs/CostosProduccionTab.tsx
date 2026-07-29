import { useEffect, useState } from 'react';
import { Info, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import CostoDeProduccion from '../cotizacion/CostoDeProduccion';
import { BASE_URL } from '../../../infrastructure/api/client';
import { formatPrice } from '../helpers';
import { Section, SectionTitle, Toolbar } from '../ui';
import type { GuardedFetch } from '../types';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

const API = `${BASE_URL}/api/costeo`;

/**
 * Cuánto cuesta producir cada presentación, ya con los accesorios que la
 * acompañan. Aquí se decide qué lleva cada tamaño por defecto (bolsa,
 * perfumero, tarjeta…) y se ve al instante cómo cambia el costo y el margen.
 *
 * Es la vista que alimentará el futuro módulo de inventario: el costo unitario
 * por presentación sale de aquí y se recalcula solo al mover precios de insumos.
 */
export function CostosProduccionTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [rf, ri] = await Promise.all([
        guardedFetch(`${API}/formulas`),
        guardedFetch(`${API}/insumos`),
      ]);
      if (!rf.ok || !ri.ok) throw new Error('respuesta no válida');
      setFormulas((await rf.json()).data ?? []);
      setInsumos((await ri.json()).data ?? []);
      setError('');
    } catch {
      setError('No se pudieron cargar los datos. Revisa tu conexión y reintenta.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      const res = await guardedFetch(`${API}/formulas/${formulaId}/accesorios`, {
        method: 'PATCH', body: JSON.stringify({ insumo_ids: ids }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo guardar los accesorios');
      setFormulas((prev) => prev.map((f) => (f.id === formulaId ? json.data : f)));
    } catch (e) {
      setFormulas(previas);
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar los accesorios', {
        id: 'accesorios-formula',
      });
    }
  };

  /** Convierte ids de insumo en el formato congelado que usa el costeo. */
  const accesoriosDe = (ids: number[]) => ids.flatMap((id) => {
    const i = insumos.find((x) => x.id === id);
    return i ? [{ insumo_id: i.id, nombre: i.nombre, precio: i.precio }] : [];
  });

  const porPedido = insumos.filter((i) => i.tipo === 'accesorio' && i.alcance === 'pedido');

  if (loading) return <Section><PerfumeSpinner /></Section>;

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={formulas.length}>Costos de producción</SectionTitle>
      </Toolbar>

      <p className="mb-5 flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Cuánto te cuesta producir cada presentación, ya con los accesorios que la acompañan.
          Marca lo que lleva cada tamaño y el costo se recalcula al instante. Si mañana cambias
          de obsequio (una tarjeta en vez de la bolsa), solo lo marcas aquí.
        </span>
      </p>

      {error && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
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
              />
            </div>
          ))}
        </div>
      )}

      {/* Costos que van una sola vez por envío, no por perfume */}
      {porPedido.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
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
    </Section>
  );
}
