import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BASE_URL } from '../../../infrastructure/api/client';
import { EncabezadoPagina, FranjaMetricas, Section, StatCard } from '../ui';
import { formatPrice } from '../helpers';
import type { GuardedFetch } from '../types';

interface Fila {
  id: number; nombre: string; tipo: string; unidad: string;
  gama: string | null;
  stock: number; minimo: number; minimo_heredado: boolean;
  consumo_diario: number; sugerido: number;
  base: 'consumo' | 'minimo';
  costo_promedio: number; costo_estimado: number;
}

interface Datos {
  esencias: Fila[]; implementos: Fila[];
  sin_historial: boolean; dias_historial: number; dias_cobertura: number;
  costo_total: number;
}

interface Gama { id: number; nombre: string; esencias: number; stock_minimo?: number }

const cantidad = (n: number, unidad: string) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${unidad === 'ml' ? 'ml' : 'u'}`;

/**
 * Pedido sugerido: qué material hay que reponer y cuánto pedir.
 *
 * Es **solo informativa**: no mueve stock ni registra nada. Vive en su propia
 * pantalla porque responde una pregunta distinta a las demás — Inventario dice
 * *qué tengo*, Producciones *qué armé*, y esta *qué me falta*.
 *
 * El punto de pedido se configura **por gama** (una vez para las 151 árabes) y
 * cada material puede llevar su excepción. Sin eso la alerta no se usaba: se
 * midió y solo 1 de 226 materiales tenía mínimo puesto, porque ponerlo a mano
 * en 219 esencias no lo hace nadie.
 */
export function ReposicionTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [gamas, setGamas] = useState<Gama[]>([]);
  const [minimos, setMinimos] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [rRepo, rGamas] = await Promise.all([
        guardedFetch(`${BASE_URL}/api/inventario/reposicion`),
        guardedFetch(`${BASE_URL}/api/costeo/gamas/todas`),
      ]);
      if (!rRepo.ok) { setError('No se pudo cargar el pedido sugerido'); return; }
      setDatos((await rRepo.json()).data);
      if (rGamas.ok) {
        const lista: Gama[] = (await rGamas.json()).data ?? [];
        setGamas(lista);
        setMinimos(Object.fromEntries(lista.map((g) => [g.id, String(g.stock_minimo ?? 0)])));
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }, [guardedFetch]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarMinimoGama = async (g: Gama) => {
    const valor = Number(minimos[g.id]);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('El mínimo tiene que ser un número', { id: 'minimo' });
      return;
    }
    const res = await guardedFetch(`${BASE_URL}/api/inventario/minimo-gama/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minimo: valor }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) { toast.error(json?.error ?? 'No se pudo guardar', { id: 'minimo' }); return; }
    toast.success(json?.message ?? 'Mínimo actualizado');
    cargar();
  };

  /**
   * La lista tal como se pega en WhatsApp: un renglón por material.
   *
   * Se le quita el sufijo "– Esencia" del nombre interno: al proveedor se le
   * pide "Eternity - 100 ml", no "Eternity – Esencia - 100 ml". Ese sufijo
   * existe para no confundir el material con el perfume dentro del sistema, y
   * fuera de él solo estorba.
   */
  const textoParaPedir = (filas: Fila[]) =>
    filas
      .map((f) => `${f.nombre.replace(/\s*[–—-]\s*esencias?\s*$/i, '').trim()} - ${cantidad(f.sugerido, f.unidad)}`)
      .join('\n');

  const copiar = async (filas: Fila[]) => {
    if (!filas.length) return;
    try {
      await navigator.clipboard.writeText(textoParaPedir(filas));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success(`${filas.length} materiales copiados. Pégalos en WhatsApp.`);
    } catch {
      // Sin permiso de portapapeles el navegador no deja copiar en silencio
      toast.error('Tu navegador no dejó copiar. Selecciona el texto a mano.', { id: 'copiar' });
    }
  };

  const Tabla = ({ titulo, filas, nota }: { titulo: string; filas: Fila[]; nota: string }) => (
    <Section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-medium text-foreground">{titulo} ({filas.length})</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{nota}</p>
        </div>
        {filas.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => copiar(filas)}>
            {copiado ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            Copiar la lista
          </Button>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-4 text-center text-[12.5px] text-muted-foreground">
          Nada por pedir aquí.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-136 border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3 font-semibold">Material</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Te queda</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Mínimo</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Pide</th>
                <th className="py-1.5 text-right font-semibold">Te costará</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 pr-3 text-foreground">
                    {f.nombre}
                    {f.gama && <span className="block text-[11px] text-muted-foreground">{f.gama}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-destructive">
                    {cantidad(f.stock, f.unidad)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {cantidad(f.minimo, f.unidad)}
                    {f.minimo_heredado && (
                      <span className="block text-[10.5px]">de su gama</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums text-foreground">
                    {cantidad(f.sugerido, f.unidad)}
                    <span className="block text-[10.5px] font-normal text-muted-foreground">
                      {f.base === 'consumo' ? 'por lo que gastas' : 'para el colchón'}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatPrice(f.costo_estimado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );

  if (cargando) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">Calculando…</p>;
  }
  if (error || !datos) {
    return (
      <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
        {error || 'No hay datos'}
        <Button size="sm" variant="outline" className="h-7" onClick={cargar}>Reintentar</Button>
      </p>
    );
  }

  const total = datos.esencias.length + datos.implementos.length;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Pedido sugerido" count={total} />

      <FranjaMetricas>
        <StatCard label="Materiales por pedir" value={String(total)}
          nota={total === 0 ? 'No te falta nada' : 'Ya tocaron su punto de pedido'} />
        <StatCard label="Esencias" value={String(datos.esencias.length)}
          nota="Se piden aparte del resto" />
        <StatCard label="Costará aproximadamente" value={formatPrice(datos.costo_total)}
          nota="Al costo promedio que llevan hoy" />
      </FranjaMetricas>

      {/* Es la pieza que hace usable la alerta: configurar 219 esencias a mano
          no lo hace nadie; configurar "las árabes" una vez, sí. */}
      <Section>
        <p className="text-[13.5px] font-medium text-foreground">¿Cuándo te aviso?</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          Pon el mínimo de cada gama y vale para todas sus esencias. Si una en concreto se
          mueve distinto, en Inventario puedes darle el suyo propio y ese manda.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-3">
          {gamas.map((g) => (
            <label key={g.id} className="w-44">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                {g.nombre} <span className="font-normal">· {g.esencias} esencias</span>
              </span>
              <div className="flex gap-1.5">
                <Input type="number" min="0" className="h-8 text-right text-[12.5px] tabular-nums"
                  value={minimos[g.id] ?? ''}
                  onChange={(e) => setMinimos((m) => ({ ...m, [g.id]: e.target.value }))} />
                <Button size="sm" variant="outline" className="h-8 px-2.5"
                  onClick={() => guardarMinimoGama(g)}>ok</Button>
              </div>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          En mililitros. En 0 no se avisa de esa gama.
        </p>
      </Section>

      {/* Honestidad sobre de dónde sale el número: sin salidas registradas no
          hay consumo que proyectar, y prometer precisión sería mentir. */}
      {datos.sin_historial && (
        <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-snug text-amber-900">
          Todavía no hay salidas registradas, así que la cantidad sugerida sale del mínimo
          que configures (te propone volver al doble). Cuando lleves unas semanas
          produciendo y vendiendo, el sistema empezará a calcularla con lo que de verdad
          gastas en {datos.dias_historial} días y a pedir para cubrir {datos.dias_cobertura}.
        </p>
      )}

      <Tabla titulo="Esencias" filas={datos.esencias}
        nota="Lo que hay que pedirle al laboratorio" />
      <Tabla titulo="Envases, accesorios y demás" filas={datos.implementos}
        nota="Frascos, perfumeros, diluyente, sellador…" />
    </div>
  );
}
