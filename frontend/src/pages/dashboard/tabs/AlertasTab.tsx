import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { EncabezadoPagina, Section } from '../ui';
import { FilaAlerta } from './alertas/FilaAlerta';
import { FILAS_ALERTA, type Alerta, type AlertaDisparada, type Ambito } from './alertas/ambitos';

/**
 * ALERTAS DE INVENTARIO: cuándo avisarle al dueño que se le está acabando algo.
 *
 * Una fila por familia de materiales, y **su número hace las dos cosas**: es el
 * punto de pedido de esa familia (lo que alimenta el pedido sugerido cuando el
 * material no tiene mínimo propio ni de gama) y el umbral del aviso. En su
 * cabeza son el mismo número; guardarlo dos veces garantiza que un día digan
 * cosas distintas.
 *
 * ## Es UN formulario, no tres que se guardan solos (2026-08-29)
 *
 * La primera versión guardaba en cuanto se salía de un campo y después volvía a
 * pedirlo todo, spinner incluido: la pantalla parpadeaba con cada cambio y no
 * había forma de tocar dos cosas y decidir. Textual del dueño: *"me molesta que
 * se actualice cada que hago un cambio… debería ser más como un formulario
 * clásico con el apartado de guardar"*.
 *
 * Ahora se edita en memoria y viaja cuando él lo dice. Y al guardar **no se
 * recarga la pantalla**: el estado se rehace con lo que responde el servidor, y
 * lo único que se vuelve a consultar es la vista previa de a cuántos materiales
 * alcanza cada regla —que sí depende de los números nuevos— sin desmontar nada.
 */

const PREDETERMINADA = (ambito: Ambito, orden: number): Alerta => ({
  id: 0, ambito, minimo: 0, forma: 'franja', titulo: null, mensaje: null, activo: true, orden,
});

/** Lo que se manda al servidor por familia. */
const aCuerpo = (a: Alerta) => ({
  ambito: a.ambito,
  minimo: a.minimo,
  forma: a.forma,
  activo: a.activo,
  titulo: a.titulo?.trim() ? a.titulo.trim() : null,
  mensaje: a.mensaje,
});

const igual = (a: Alerta, b: Alerta) => JSON.stringify(aCuerpo(a)) === JSON.stringify(aCuerpo(b));

export function AlertasTab() {
  /** Lo guardado en el servidor: contra esto se compara para saber qué cambió. */
  const [guardadas, setGuardadas] = useState<Record<Ambito, Alerta> | null>(null);
  /** Lo que el dueño está editando. Solo viaja cuando pulsa Guardar. */
  const [borrador, setBorrador] = useState<Record<Ambito, Alerta> | null>(null);
  const [activas, setActivas] = useState<AlertaDisparada[]>([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const traerActivas = useCallback(async () => {
    const r = await http.get<{ data: AlertaDisparada[] }>(urls.inventario.alertasActivas);
    // Si falla la vista previa, la configuración se sigue pudiendo editar.
    if (r.ok) setActivas(r.cuerpo?.data ?? []);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const r = await http.get<{ data: Alerta[] }>(urls.inventario.alertas);
      if (!r.ok) { setError(r.error); return; }
      const porAmbito = Object.fromEntries((r.cuerpo?.data ?? []).map((a) => [a.ambito, a]));
      const completas = Object.fromEntries(
        FILAS_ALERTA.map((f, i) => [f.ambito, porAmbito[f.ambito] ?? PREDETERMINADA(f.ambito, i + 1)]),
      ) as Record<Ambito, Alerta>;
      setGuardadas(completas);
      setBorrador(completas);
      setError('');
      await traerActivas();
    } catch {
      setError('No se pudo conectar con el servidor');
    }
  }, [traerActivas]);

  useEffect(() => { cargar(); }, [cargar]);

  /** Qué familias tienen cambios sin guardar. */
  const cambiadas = useMemo<Ambito[]>(() => {
    if (!borrador || !guardadas) return [];
    return FILAS_ALERTA.map((f) => f.ambito).filter((a) => !igual(borrador[a], guardadas[a]));
  }, [borrador, guardadas]);

  const editar = (ambito: Ambito, cambios: Partial<Alerta>) =>
    setBorrador((prev) => (prev ? { ...prev, [ambito]: { ...prev[ambito], ...cambios } } : prev));

  const guardar = async () => {
    if (!borrador || !cambiadas.length) return;
    setGuardando(true);
    try {
      const nuevas = { ...borrador };
      for (const ambito of cambiadas) {
        const res = await http.post<{ data: Alerta }>(urls.inventario.alertas, aCuerpo(borrador[ambito]));
        if (!res.ok) { toast.error(res.error, { id: 'alerta' }); return; }
        // Se toma lo que responde el servidor en vez de volver a preguntarlo:
        // trae el id nuevo y lo que él haya normalizado.
        if (res.cuerpo?.data) nuevas[ambito] = res.cuerpo.data;
      }
      setGuardadas(nuevas);
      setBorrador(nuevas);
      toast.success(cambiadas.length === 1 ? 'Alerta guardada' : 'Alertas guardadas');
      // Los números cambiaron, así que la vista previa se rehace: sin spinner y
      // sin desmontar el formulario, que era lo que hacía parpadear la pantalla.
      await traerActivas();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'alerta' }); }
    finally { setGuardando(false); }
  };

  if (!borrador) {
    return (
      <Section>
        {error ? (
          <p className="flex flex-wrap items-center gap-3 text-[13px] font-medium text-destructive">
            {error}
            <Button size="sm" variant="outline" className="h-7" onClick={cargar}>Reintentar</Button>
          </p>
        ) : <PerfumeSpinner />}
      </Section>
    );
  }

  return (
    <div className="space-y-3">
      <EncabezadoPagina titulo="Alertas de inventario" count={activas.length} />

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-2.5 text-[12.5px] leading-snug text-primary">
        <BellRing className="mt-0.5 size-4 shrink-0" />
        <span>
          Este número hace dos cosas: te avisa y le dice al <strong>pedido sugerido</strong> cuánto
          reponer de lo que no tenga mínimo propio ni de su gama. Los mínimos por{' '}
          <strong>gama de esencia</strong> siguen en <em>Pedido sugerido</em> y mandan sobre estos.
        </span>
      </p>

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={cargar}>Reintentar</Button>
        </p>
      )}

      <Section className="space-y-0 p-4 md:p-5">
        <div className="hidden grid-cols-[minmax(0,1.9fr)_132px_170px_minmax(0,1.2fr)_auto] gap-x-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
          <span>Familia</span>
          <span>Mínimo</span>
          <span>Cómo avisa</span>
          <span>Texto propio (opcional)</span>
          <span />
        </div>

        {FILAS_ALERTA.map((f) => (
          <div key={f.ambito} className="border-t border-border">
            <FilaAlerta
              fila={f}
              valor={borrador[f.ambito]}
              disparada={activas.find((d) => d.ambito === f.ambito)}
              tocada={cambiadas.includes(f.ambito)}
              onCambio={(cambios) => editar(f.ambito, cambios)}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
          <span className="mr-auto text-[12.5px] text-muted-foreground">
            {cambiadas.length
              ? `Cambios sin guardar en ${cambiadas.length === 1 ? '1 familia' : `${cambiadas.length} familias`}.`
              : 'Todo guardado.'}
          </span>
          {!!cambiadas.length && (
            <Button size="sm" variant="ghost" disabled={guardando}
              onClick={() => setBorrador(guardadas)}>
              Deshacer
            </Button>
          )}
          <Button size="sm" disabled={!cambiadas.length || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </Section>
    </div>
  );
}
