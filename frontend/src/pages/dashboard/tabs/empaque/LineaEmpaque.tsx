import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import type { ConfigEmpaque } from '../../../../application/hooks/useEmpaque';
import type { LineaEmpaque as Linea, ReglaEmpaque } from '../../pedido/empaque.calculo';

/** Una talla de la línea con lo que lleva: accesorio → cantidad. */
type Filas = Map<number | null, Map<number, number>>;

const aFilas = (reglas: ReglaEmpaque[]): Filas => {
  const m: Filas = new Map();
  for (const r of reglas) m.set(r.presentacion_id, new Map(m.get(r.presentacion_id) ?? []).set(r.perfume_id, r.cantidad));
  return m;
};
const aReglas = (linea: Linea, filas: Filas) => [...filas].flatMap(([presentacion_id, acc]) =>
  [...acc].filter(([, n]) => n > 0).map(([perfume_id, cantidad]) => ({ linea, presentacion_id, perfume_id, cantidad })));
const firma = (reglas: { presentacion_id: number | null; perfume_id: number; cantidad: number }[]) =>
  JSON.stringify([...reglas].map(r => [r.presentacion_id, r.perfume_id, r.cantidad]).sort());

/** El renglón de una talla: sus accesorios con − / + y un buscador para agregar otro. */
function FilaTalla({ etiqueta, acc, accesorios, onCambiar, onQuitarTalla }: {
  etiqueta: string;
  acc: Map<number, number>;
  accesorios: ConfigEmpaque['accesorios'];
  onCambiar: (perfumeId: number, cantidad: number) => void;
  onQuitarTalla?: () => void;
}) {
  const libres = accesorios.filter(a => !acc.has(a.id));
  return (
    <li className="flex flex-col gap-2 border-t border-border py-2.5 first:border-t-0 sm:flex-row sm:items-center">
      <span className="w-36 shrink-0 text-[13px] font-medium text-foreground">{etiqueta}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {acc.size === 0 && <span className="text-[12.5px] text-muted-foreground">No lleva nada</span>}
        {[...acc].map(([id, n]) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 py-0.5 pl-2.5 pr-1 text-[12.5px]">
            {accesorios.find(a => a.id === id)?.nombre ?? `#${id}`}
            <button type="button" aria-label="Uno menos" className="rounded-full p-0.5 hover:bg-secondary" onClick={() => onCambiar(id, n - 1)}>
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-4 text-center font-semibold tabular-nums">{n}</span>
            <button type="button" aria-label="Uno más" className="rounded-full p-0.5 hover:bg-secondary" onClick={() => onCambiar(id, n + 1)}>
              <Plus className="size-3.5" />
            </button>
          </span>
        ))}
        {libres.length > 0 && (
          <BuscadorSelect
            className="w-40"
            aria-label={`Agregar a ${etiqueta}`}
            placeholder="+ Agregar"
            opciones={libres.map(a => ({ id: a.id, nombre: a.nombre }))}
            onSelect={id => onCambiar(Number(id), 1)}
            value={null}
          />
        )}
      </div>
      {onQuitarTalla && (
        <button type="button" aria-label={`Quitar ${etiqueta}`} title="Quitar esta talla"
          className="self-end rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground sm:self-center"
          onClick={onQuitarTalla}>
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}

/**
 * El empaque de UNA línea: una fila por talla que lleva algo, y se guarda la
 * línea entera de una vez (`PATCH /api/empaque`). La botella completa de un
 * original no va por talla: una sola fila vale para cualquier botella.
 */
export function LineaEmpaque({ linea, titulo, ayuda, config, onGuardado }: {
  linea: Linea;
  titulo: string;
  ayuda: string;
  config: ConfigEmpaque;
  onGuardado: (nueva: ConfigEmpaque) => void;
}) {
  const guardadas = useMemo(() => config.reglas.filter(r => r.linea === linea), [config, linea]);
  const [filas, setFilas] = useState<Filas>(() => aFilas(guardadas));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setFilas(aFilas(guardadas)); }, [guardadas]);

  const porTalla = linea === 'botella_completa';
  // La botella completa siempre enseña su única fila, aunque no lleve nada
  const vista: Filas = porTalla && !filas.has(null) ? new Map(filas).set(null, new Map()) : filas;
  const tallasLibres = config.tallas.filter(t => t.ml != null && !filas.has(t.id));
  const sucio = firma(aReglas(linea, filas)) !== firma(guardadas);

  const cambiar = (talla: number | null, perfumeId: number, cantidad: number) => setFilas(prev => {
    const acc = new Map(prev.get(talla) ?? []);
    if (cantidad <= 0) acc.delete(perfumeId); else acc.set(perfumeId, Math.min(cantidad, 50));
    return new Map(prev).set(talla, acc);
  });
  const quitarTalla = (talla: number | null) => setFilas(prev => { const m = new Map(prev); m.delete(talla); return m; });

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await http.patch<{ data: ConfigEmpaque; message?: string }>(urls.empaque, {
        linea, filas: aReglas(linea, filas).map(({ presentacion_id, perfume_id, cantidad }) => ({ presentacion_id, perfume_id, cantidad })),
      });
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: `empaque-${linea}` }); return; }
      toast.success(`${titulo}: empaque guardado`, { id: `empaque-${linea}` });
      onGuardado(res.cuerpo.data);
    } catch { toast.error('No se pudo conectar con el servidor', { id: `empaque-${linea}` }); }
    finally { setGuardando(false); }
  };

  const nombreTalla = (id: number | null) => (id == null ? 'Cualquier botella' : config.tallas.find(t => t.id === id)?.nombre ?? `#${id}`);
  const ordenadas = [...vista.keys()].sort((a, b) =>
    (config.tallas.find(t => t.id === a)?.ml ?? 0) - (config.tallas.find(t => t.id === b)?.ml ?? 0));

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label={titulo}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-medium text-foreground">{titulo}</h3>
          <p className="text-[12.5px] text-muted-foreground">{ayuda}</p>
        </div>
        <Button size="sm" disabled={!sucio || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      <ul className="mt-2">
        {ordenadas.length === 0 && (
          <li className="py-2.5 text-[12.5px] text-muted-foreground">Ninguna talla lleva empaque.</li>
        )}
        {ordenadas.map(t => (
          <FilaTalla key={t ?? 'botella'} etiqueta={nombreTalla(t)} acc={vista.get(t)!} accesorios={config.accesorios}
            onCambiar={(id, n) => cambiar(t, id, n)}
            onQuitarTalla={porTalla ? undefined : () => quitarTalla(t)} />
        ))}
      </ul>
      {!porTalla && tallasLibres.length > 0 && (
        <BuscadorSelect
          className="mt-1 w-48"
          aria-label={`Agregar talla a ${titulo}`}
          placeholder="+ Talla que lleva empaque"
          opciones={tallasLibres.map(t => ({ id: t.id, nombre: t.nombre }))}
          onSelect={id => setFilas(prev => new Map(prev).set(Number(id), new Map()))}
          value={null}
        />
      )}
    </section>
  );
}
