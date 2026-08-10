import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../../../../components/Modal';
import { Button } from '@/components/ui/button';
import { BASE_URL } from '../../../../infrastructure/api/client';
import type { GuardedFetch } from '../../types';

interface Candidato { id: number; nombre: string; genero: string | null; parecido: number }

interface Pendiente {
  insumo_id: number;
  esencia: string;
  fragancia: string;
  gama: string | null;
  genero: string | null;
  stock: number;
  candidatos: Candidato[];
  claro: boolean;
  conflicto: boolean;
}

/** Qué se decidió para cada esencia: nada, enlazar con un perfume, o crear. */
type Decision = { tipo: 'nada' } | { tipo: 'enlazar'; perfume_id: number } | { tipo: 'crear' };

const GENERO_TEXTO: Record<string, string> = {
  dama: 'Dama', caballero: 'Caballero', unisex: 'Unisex',
};

/**
 * Puesta al día: emparejar las esencias que ya están en el sistema con su
 * perfume del catálogo.
 *
 * El alta desde una compra deja enlazada toda esencia NUEVA, pero no toca las
 * que ya estaban. Aquí se salda ese atraso, que no es cosmético: un perfume sin
 * esencia **no descuenta nada al venderse y su costo entra en cero**.
 *
 * **PROPONE, no aplica.** Medido contra los datos reales, el emparejador acierta
 * la mayoría pero se equivoca en algunas (una esencia llamada por la marca, una
 * variante "Night" contra un perfume "Black"), y un enlace errado descuenta la
 * fragancia que no era y falsea el costo en silencio. Por eso lo dudoso arranca
 * en "no hacer nada" y solo lo inequívoco viene marcado.
 */
export function EmparejarEsenciasModal({ guardedFetch, onClose, onGuardado }: {
  guardedFetch: GuardedFetch; onClose: () => void; onGuardado: () => void;
}) {
  return <Contenido guardedFetch={guardedFetch} onClose={onClose} onGuardado={onGuardado} />;
}

/**
 * Aviso que aparece en Inventario cuando quedan esencias sin emparejar, y se
 * esconde solo cuando no queda ninguna (igual que Primeros pasos).
 *
 * Va aquí y no como un botón más de la barra: esa fila ya tiene seis y esta es
 * una tarea que se termina. Un botón permanente para algo que deja de existir
 * ocupa sitio para siempre.
 */
export function AvisoEsenciasSinPerfume({ guardedFetch, onGuardado }: {
  guardedFetch: GuardedFetch; onGuardado: () => void;
}) {
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await guardedFetch(`${BASE_URL}/api/parfums/esencia/emparejar`);
        if (!res.ok || !vivo) return;
        const datos = (await res.json()).data ?? [];
        if (vivo) setPendientes(datos.length);
      } catch { /* sin aviso; la pantalla sigue funcionando igual */ }
    })();
    return () => { vivo = false; };
  }, [guardedFetch, version]);

  if (!pendientes) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-3.5 py-3">
        <p className="text-[12.5px] leading-snug text-amber-900">
          <strong>{pendientes} esencias no tienen su perfume en el catálogo.</strong>{' '}
          Mientras siga así, esos perfumes no descuentan inventario al venderse y su costo
          entra en cero, así que la ganancia del mes sale más alta de lo real.
        </p>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => setAbierto(true)}>
          Emparejarlas
        </Button>
      </div>
      {abierto && (
        <Contenido
          guardedFetch={guardedFetch}
          onClose={() => setAbierto(false)}
          onGuardado={() => { setVersion((v) => v + 1); onGuardado(); }}
        />
      )}
    </>
  );
}

function Contenido({ guardedFetch, onClose, onGuardado }: {
  guardedFetch: GuardedFetch; onClose: () => void; onGuardado: () => void;
}) {
  const [filas, setFilas] = useState<Pendiente[]>([]);
  const [decisiones, setDecisiones] = useState<Record<number, Decision>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await guardedFetch(`${BASE_URL}/api/parfums/esencia/emparejar`);
        const json = await res.json().catch(() => null);
        if (!vivo) return;
        if (!res.ok) { setError(json?.error ?? 'No se pudo cargar la lista'); return; }
        const datos: Pendiente[] = json.data ?? [];
        setFilas(datos);
        // Solo lo inequívoco viene marcado. Lo dudoso y lo que se disputan dos
        // esencias arranca en "no hacer nada": elegir por el dueño ahí sería
        // meterle un dato falso que después nadie sabe que está mal.
        setDecisiones(Object.fromEntries(datos.map((f) => [
          f.insumo_id,
          f.claro && f.candidatos.length
            ? { tipo: 'enlazar', perfume_id: f.candidatos[0].id }
            : { tipo: 'nada' },
        ])));
      } catch {
        if (vivo) setError('No se pudo conectar con el servidor');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [guardedFetch]);

  const decidir = (insumo_id: number, d: Decision) =>
    setDecisiones((prev) => ({ ...prev, [insumo_id]: d }));

  const acciones = useMemo(() => filas.flatMap((f) => {
    const d = decisiones[f.insumo_id];
    if (!d || d.tipo === 'nada') return [];
    return [d.tipo === 'enlazar'
      ? { insumo_id: f.insumo_id, perfume_id: d.perfume_id }
      : { insumo_id: f.insumo_id, crear: f.fragancia }];
  }), [filas, decisiones]);

  /**
   * Dos esencias apuntando al MISMO perfume: solo una puede quedarse con él.
   * Se comprueba aquí, antes de mandar, porque el servidor las aplicaría en
   * orden y la segunda se rechazaría con un mensaje que no dice qué elegir.
   */
  const perfumesRepetidos = useMemo(() => {
    const cuenta = new Map<number, number>();
    for (const a of acciones) {
      if ('perfume_id' in a && a.perfume_id) cuenta.set(a.perfume_id, (cuenta.get(a.perfume_id) ?? 0) + 1);
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [acciones]);

  const aplicar = async () => {
    if (!acciones.length) { toast.error('No elegiste ninguna esencia', { id: 'emparejar' }); return; }
    if (perfumesRepetidos.size) {
      toast.error('Hay un perfume elegido por dos esencias distintas. Deja solo una.', { id: 'emparejar' });
      return;
    }
    setGuardando(true);
    try {
      const res = await guardedFetch(`${BASE_URL}/api/parfums/esencia/emparejar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acciones }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo aplicar', { id: 'emparejar' }); return; }
      toast.success(json?.message ?? 'Listo');
      (json?.data?.omitidos ?? []).forEach((m: string) => toast.warning(m));
      onGuardado();
      onClose();
    } catch {
      toast.error('No se pudo conectar con el servidor', { id: 'emparejar' });
    } finally { setGuardando(false); }
  };

  const claros = filas.filter((f) => f.claro).length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Esencias que no tienen su perfume"
      maxWidth={720}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={aplicar} disabled={guardando || !acciones.length}>
            {guardando ? 'Aplicando…' : `Aplicar (${acciones.length})`}
          </Button>
        </div>
      }
    >
      {cargando ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Buscando…</p>
      ) : error ? (
        <p className="py-6 text-center text-[13px] text-destructive">{error}</p>
      ) : filas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Todas tus esencias ya tienen su perfume. No hay nada que hacer aquí.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-[12.5px] leading-snug">
            <p className="text-foreground">
              Tienes <strong>{filas.length}</strong> esencias que ningún perfume está usando.
            </p>
            <p className="mt-1 text-muted-foreground">
              Mientras un perfume no tenga su esencia, al venderse <strong>no descuenta nada
              del inventario y su costo entra en cero</strong>, así que la ganancia del mes
              sale más alta de lo real.
            </p>
            <p className="mt-1 text-muted-foreground">
              Ya vienen marcadas las <strong>{claros}</strong> que no dejan duda. Las demás
              las decides tú: una equivocada descontaría la fragancia que no es.
            </p>
          </div>

          <ul className="space-y-2">
            {filas.map((f) => {
              const d = decisiones[f.insumo_id] ?? { tipo: 'nada' };
              const elegido = d.tipo === 'enlazar' ? d.perfume_id : null;
              const repetido = elegido != null && perfumesRepetidos.has(elegido);
              return (
                <li key={f.insumo_id}
                  className={`rounded-lg border p-2.5 ${
                    repetido ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-card'
                  }`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <p className="text-[13px] font-medium text-foreground">{f.esencia}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {[f.gama, f.genero ? GENERO_TEXTO[f.genero] : null,
                        `${f.stock.toLocaleString('es-CO')} ml`].filter(Boolean).join('  ·  ')}
                    </p>
                  </div>

                  {f.conflicto && (
                    <p className="mt-1 flex items-start gap-1.5 text-[11.5px] text-amber-700">
                      <AlertTriangle className="mt-px size-3.5 shrink-0" />
                      Otra esencia apunta al mismo perfume. Solo una puede quedárselo.
                    </p>
                  )}

                  <div className="mt-1.5 space-y-1">
                    {f.candidatos.map((c) => (
                      <label key={c.id} className="flex items-start gap-2">
                        <input type="radio" className="mt-0.5 size-3.5 shrink-0 accent-primary"
                          name={`esencia-${f.insumo_id}`}
                          checked={elegido === c.id}
                          onChange={() => decidir(f.insumo_id, { tipo: 'enlazar', perfume_id: c.id })} />
                        <span className="text-[12.5px] leading-snug">
                          <span className="text-foreground">{c.nombre}</span>
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            {c.genero ? `${GENERO_TEXTO[c.genero]} · ` : ''}
                            se parece {Math.round(c.parecido * 100)}%
                          </span>
                        </span>
                      </label>
                    ))}

                    <label className="flex items-start gap-2">
                      <input type="radio" className="mt-0.5 size-3.5 shrink-0 accent-primary"
                        name={`esencia-${f.insumo_id}`}
                        checked={d.tipo === 'crear'}
                        onChange={() => decidir(f.insumo_id, { tipo: 'crear' })} />
                      <span className="text-[12.5px] leading-snug text-foreground">
                        No está en el catálogo: crear <strong>{f.fragancia}</strong>
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          (fuera de la tienda, para completarlo después)
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input type="radio" className="mt-0.5 size-3.5 shrink-0 accent-primary"
                        name={`esencia-${f.insumo_id}`}
                        checked={d.tipo === 'nada'}
                        onChange={() => decidir(f.insumo_id, { tipo: 'nada' })} />
                      <span className="text-[12.5px] leading-snug text-muted-foreground">
                        Dejar así por ahora
                      </span>
                    </label>
                  </div>

                  {repetido && (
                    <p className="mt-1 text-[11.5px] font-medium text-destructive">
                      Ese perfume ya lo eligió otra esencia de esta lista.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
