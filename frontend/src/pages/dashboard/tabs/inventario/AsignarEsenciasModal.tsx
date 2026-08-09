import { useEffect, useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../../components/Modal';
import PerfumeSpinner from '../../../../components/PerfumeSpinner';
import { BASE_URL } from '../../../../infrastructure/api/client';
import { Field } from '../../ui';
import type { GuardedFetch } from '../../types';
import type { Insumo } from '../../../../domain/entities/cotizacion.types';

/** Materias primas que NO son la fragancia (mismo criterio que el costeo). */
const esNoEsencia = (nombre: string) => {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ['diluyente', 'sellador', 'feromona', 'alcohol'].some(k => n.includes(k));
};

/** Un enlace perfume→esencia propuesto por el nombre, aún sin aplicar. */
interface Sugerencia {
  perfume_id: number; perfume: string;
  insumo_id: number; esencia: string;
}

interface PerfumeFila {
  id: number;
  nombre: string;
  insumo_esencia_id: number | null;
  tipo_producto: string;
}

interface Props {
  guardedFetch: GuardedFetch;
  onClose: () => void;
  /** Se llama tras guardar, para refrescar el contador de primeros pasos. */
  onGuardado: () => void;
}

/**
 * Asignar la misma esencia a varios perfumes de una vez.
 *
 * Nace porque hacerlo en la ficha de cada perfume son 212 visitas — y sin
 * esencia asignada la venta no descuenta material ni el costo es real. Solo
 * lista los FABRICADOS: un splash comprado o una gorra no llevan receta.
 */
export function AsignarEsenciasModal({ guardedFetch, onClose, onGuardado }: Props) {
  const [perfumes, setPerfumes] = useState<PerfumeFila[]>([]);
  const [esencias, setEsencias] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busca, setBusca] = useState('');
  const [soloFaltan, setSoloFaltan] = useState(true);
  const [esenciaId, setEsenciaId] = useState<number | ''>('');
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  /**
   * Sugerencias del enlace automático. Se piden, se MUESTRAN, y solo se aplican
   * si el dueño confirma: son 175 cambios de golpe y tiene que poder verlos
   * antes, no después.
   */
  const [sugeridos, setSugeridos] = useState<Sugerencia[] | null>(null);
  const [buscandoSug, setBuscandoSug] = useState(false);

  const pedirSugerencias = async () => {
    setBuscandoSug(true);
    try {
      const r = await guardedFetch(`${BASE_URL}/api/parfums/esencia/sugerencias`);
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast.error(j?.error ?? 'No se pudieron calcular', { id: 'esencias' }); return; }
      const lista: Sugerencia[] = j?.data?.enlaces ?? [];
      if (lista.length === 0) {
        toast('No encontré ninguna esencia que coincida por nombre', { id: 'esencias' });
        return;
      }
      setSugeridos(lista);
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'esencias' }); }
    finally { setBuscandoSug(false); }
  };

  const aplicarSugerencias = async () => {
    if (!sugeridos) return;
    setGuardando(true);
    try {
      const r = await guardedFetch(`${BASE_URL}/api/parfums/esencia/enlaces`, {
        method: 'PATCH',
        body: JSON.stringify({
          enlaces: sugeridos.map(s => ({ perfume_id: s.perfume_id, insumo_esencia_id: s.insumo_id })),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast.error(j?.error ?? 'No se pudo aplicar', { id: 'esencias' }); return; }
      toast.success(j?.message ?? 'Enlaces aplicados');
      setSugeridos(null);
      setPerfumes(prev => prev.map(p => {
        const s = sugeridos.find(x => x.perfume_id === p.id);
        return s ? { ...p, insumo_esencia_id: s.insumo_id } : p;
      }));
      onGuardado();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'esencias' }); }
    finally { setGuardando(false); }
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [rp, ri] = await Promise.all([
          guardedFetch(`${BASE_URL}/api/parfums`),
          guardedFetch(`${BASE_URL}/api/costeo/insumos`),
        ]);
        const jp = rp.ok ? await rp.json() : null;
        // /api/parfums sin paginar responde { data: { data: [...] } }
        const lista = Array.isArray(jp?.data) ? jp.data : (jp?.data?.data ?? []);
        const ji = ri.ok ? await ri.json() : null;
        if (!vivo) return;
        setPerfumes(lista
          .filter((x: PerfumeFila) => (x.tipo_producto ?? 'fabricado') === 'fabricado')
          .map((x: PerfumeFila) => ({
            id: x.id, nombre: x.nombre,
            insumo_esencia_id: x.insumo_esencia_id ?? null,
            tipo_producto: x.tipo_producto ?? 'fabricado',
          })));
        // Las esencias van PRIMERO. El diluyente, el sellador y las feromonas
        // también son materia prima, pero no son la fragancia: si el selector
        // abre en "Diluyente" invita a asignar el insumo equivocado. Se ordenan
        // con el mismo criterio por nombre que usa el motor de costeo.
        const ins: Insumo[] = (ji?.data ?? []).filter((i: Insumo) => i.tipo === 'materia_prima');
        const ordenadas = [...ins].sort((a, b) =>
          Number(esNoEsencia(a.nombre)) - Number(esNoEsencia(b.nombre)) || a.nombre.localeCompare(b.nombre));
        setEsencias(ordenadas);
        setEsenciaId(ordenadas[0]?.id ?? '');
      } catch {
        toast.error('No se pudieron cargar los perfumes', { id: 'esencias' });
      } finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [guardedFetch]);

  const nombreEsencia = (id: number | null) => esencias.find(e => e.id === id)?.nombre ?? null;

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return perfumes.filter(p =>
      (!soloFaltan || p.insumo_esencia_id === null)
      && (!q || p.nombre.toLowerCase().includes(q)));
  }, [perfumes, busca, soloFaltan]);

  const faltan = perfumes.filter(p => p.insumo_esencia_id === null).length;

  const alternar = (id: number) => setMarcados(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  /** Marca o desmarca TODO lo que se está viendo, no todo el catálogo. */
  const alternarVisibles = () => setMarcados(prev => {
    const todos = visibles.every(v => prev.has(v.id));
    const s = new Set(prev);
    visibles.forEach(v => (todos ? s.delete(v.id) : s.add(v.id)));
    return s;
  });

  const guardar = async () => {
    if (marcados.size === 0) { toast.error('Marca al menos un perfume', { id: 'esencias' }); return; }
    if (!esenciaId) { toast.error('Elige la esencia que vas a asignar', { id: 'esencias' }); return; }
    setGuardando(true);
    try {
      const res = await guardedFetch(`${BASE_URL}/api/parfums/esencia/masiva`, {
        method: 'PATCH',
        body: JSON.stringify({ perfume_ids: [...marcados], insumo_esencia_id: Number(esenciaId) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo asignar', { id: 'esencias' }); return; }
      toast.success(json?.message ?? 'Esencia asignada');
      // Se refleja en la lista sin recargar todo el catálogo
      setPerfumes(prev => prev.map(p =>
        marcados.has(p.id) ? { ...p, insumo_esencia_id: Number(esenciaId) } : p));
      setMarcados(new Set());
      onGuardado();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'esencias' }); }
    finally { setGuardando(false); }
  };

  return (
    // El footer se reemplaza por un simple Cerrar: la acción real es el botón
    // "Asignar a N marcados", y un "Guardar" al pie que no guarda nada confunde.
    <Modal
      open onClose={onClose} title="Asignar esencias" maxWidth={720}
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      {cargando ? <PerfumeSpinner /> : (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Cada fragancia se hace con una esencia distinta y cada una cuesta diferente por ml.
            Marca varios perfumes y asígnales la suya de una vez.
            {faltan > 0 && <> Faltan <strong className="text-foreground">{faltan}</strong>.</>}
          </p>

          {/* Enlace automático: tus esencias se llaman como la fragancia, así que
              el nombre ya dice a qué perfume pertenecen. Se PROPONE y se revisa;
              nunca se aplica sin confirmar. */}
          {sugeridos === null ? (
            faltan > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-brand-soft/50 px-3.5 py-2.5">
                <span className="text-[12.5px] text-primary">
                  <strong>¿Tus esencias se llaman como el perfume?</strong> Puedo enlazarlas
                  solas y te muestro qué haría antes de tocar nada.
                </span>
                <Button type="button" size="sm" variant="outline"
                  onClick={pedirSugerencias} disabled={buscandoSug}>
                  <Wand2 className="size-4" />
                  {buscandoSug ? 'Revisando…' : 'Enlazar automáticamente'}
                </Button>
              </div>
            )
          ) : (
            <div className="rounded-xl border border-primary/40 bg-brand-soft/60 px-3.5 py-3">
              <p className="text-[13px] font-medium text-primary">
                Encontré {sugeridos.length} coincidencias. Revísalas antes de aplicar.
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Solo toca perfumes que hoy NO tienen esencia. Si alguna está mal, cancela y
                hazlo a mano: un enlace equivocado descuenta la esencia de otra fragancia.
              </p>
              <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
                {sugeridos.map(s => (
                  <li key={s.perfume_id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-[12.5px]">
                    <span className="min-w-32 flex-1 text-foreground">{s.perfume}</span>
                    <span className="text-muted-foreground">← {s.esencia}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" variant="outline"
                  onClick={() => setSugeridos(null)}>Cancelar</Button>
                <Button type="button" size="sm" onClick={aplicarSugerencias} disabled={guardando}>
                  {guardando ? 'Aplicando…' : `Aplicar las ${sugeridos.length}`}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <Field label="Esencia a aplicar" className="min-w-52 flex-1">
              <NativeSelect value={esenciaId} onChange={e => setEsenciaId(Number(e.target.value) || '')}>
                {esencias.length === 0 && <option value="">— No hay materias primas registradas —</option>}
                {esencias.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </NativeSelect>
            </Field>
            <Button type="button" onClick={guardar} disabled={guardando || marcados.size === 0}>
              {guardando ? 'Asignando…' : `Asignar a ${marcados.size} ${marcados.size === 1 ? 'marcado' : 'marcados'}`}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar perfume…" className="h-9 min-w-44 flex-1"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <input type="checkbox" className="size-3.5 accent-primary"
                checked={soloFaltan} onChange={e => setSoloFaltan(e.target.checked)} />
              Solo los que faltan
            </label>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={alternarVisibles}>
              Marcar todos los visibles
            </Button>
          </div>

          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {visibles.length === 0 && (
              <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                {soloFaltan ? 'No falta ninguno. ¡Listo!' : 'Ningún perfume coincide.'}
              </li>
            )}
            {visibles.map(p => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-secondary/50">
                  <input type="checkbox" className="size-4 shrink-0 accent-primary"
                    checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
                  <span className="min-w-32 flex-1 text-[13px] text-foreground">{p.nombre}</span>
                  <span className={`text-[12px] ${p.insumo_esencia_id ? 'text-muted-foreground' : 'font-medium text-amber-700'}`}>
                    {nombreEsencia(p.insumo_esencia_id) ?? 'sin esencia'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
