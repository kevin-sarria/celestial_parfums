import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { EncabezadoPagina, Field, FieldRow, Section } from '../ui';
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
 * Nace de que poner el mínimo material por material no lo hace nadie: se midió y
 * **1 de 226** lo tenía.
 */
export function AlertasTab() {
  const [alertas, setAlertas] = useState<Record<string, Alerta>>({});
  const [activas, setActivas] = useState<AlertaDisparada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState<Ambito | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rA, rD] = await Promise.all([
        http.get<{ data: Alerta[] }>(urls.inventario.alertas),
        http.get<{ data: AlertaDisparada[] }>(urls.inventario.alertasActivas),
      ]);
      if (!rA.ok) { setError(rA.error); return; }
      setAlertas(Object.fromEntries((rA.cuerpo?.data ?? []).map((a) => [a.ambito, a])));
      // Si falla la vista previa, la configuración se sigue pudiendo editar.
      if (rD.ok) setActivas(rD.cuerpo?.data ?? []);
      setError('');
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (ambito: Ambito, cambios: Partial<Alerta>) => {
    const actual = alertas[ambito];
    const cuerpo = {
      ambito,
      minimo: cambios.minimo ?? actual?.minimo ?? 0,
      forma: cambios.forma ?? actual?.forma ?? 'franja',
      activo: cambios.activo ?? actual?.activo ?? true,
      titulo: cambios.titulo ?? actual?.titulo ?? null,
      mensaje: cambios.mensaje ?? actual?.mensaje ?? null,
    };
    setGuardando(ambito);
    try {
      const res = await http.post<{ data: Alerta }>(urls.inventario.alertas, cuerpo);
      if (!res.ok) { toast.error(res.error, { id: 'alerta' }); return; }
      toast.success('Alerta guardada');
      await cargar();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'alerta' }); }
    finally { setGuardando(null); }
  };

  if (cargando) return <Section><PerfumeSpinner /></Section>;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Alertas de inventario" count={activas.length} />

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <BellRing className="mt-0.5 size-4 shrink-0" />
        <span>
          Dile al sistema con cuánto material quieres que te avise. Ese mismo número es el que usa
          el <strong>pedido sugerido</strong> para lo que no tenga su propio mínimo ni el de su
          gama, así que lo configuras una vez y sirve para las dos cosas.
          <br />
          Los mínimos por <strong>gama de esencia</strong> (árabes, nicho…) siguen donde estaban:
          en <em>Pedido sugerido → ¿Cuándo te aviso?</em>, y mandan sobre estos.
        </span>
      </p>

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={cargar}>Reintentar</Button>
        </p>
      )}

      {FILAS_ALERTA.map((f) => {
        const a = alertas[f.ambito];
        const disparada = activas.find((d) => d.ambito === f.ambito);
        return (
          <Section key={f.ambito}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-foreground">{f.titulo}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{f.explicacion}</p>
              </div>
              <Button size="sm" className="shrink-0" variant={a?.activo === false ? 'outline' : 'default'}
                disabled={guardando === f.ambito}
                onClick={() => guardar(f.ambito, { activo: !(a?.activo ?? true) })}>
                {a?.activo === false ? 'Apagada' : 'Encendida'}
              </Button>
            </div>

            <FieldRow>
              <Field label={`Avísame cuando queden menos de (${f.unidad})`}>
                <Input
                  type="number" min="0" defaultValue={a?.minimo ?? ''}
                  placeholder="0 = sin alerta"
                  onBlur={(e) => {
                    const n = Number(e.target.value) || 0;
                    if (n !== (a?.minimo ?? 0)) guardar(f.ambito, { minimo: n });
                  }}
                />
              </Field>
              <Field label="¿Cómo quieres que te avise?">
                <SelectSimple
                  value={a?.forma ?? 'franja'}
                  onChange={(e) => guardar(f.ambito, { forma: e.target.value as Alerta['forma'] })}
                >
                  <option value="franja">Franja arriba (discreta)</option>
                  <option value="ventana">Ventana en medio (no se puede ignorar)</option>
                </SelectSimple>
              </Field>
            </FieldRow>

            <Field label="Texto propio del aviso (opcional)">
              <Input
                defaultValue={a?.titulo ?? ''} maxLength={150}
                placeholder={`Vacío = "${f.titulo} por debajo del mínimo"`}
                onBlur={(e) => {
                  if (e.target.value !== (a?.titulo ?? '')) guardar(f.ambito, { titulo: e.target.value });
                }}
              />
            </Field>

            {/* Lo que la regla está marcando AHORA. Sin esto, poner un número es
                adivinar: aquí se ve al instante a cuántos materiales alcanza. */}
            {disparada ? (
              <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] text-amber-800">
                <AlertTriangle className="mr-1 inline size-3.5" />
                Ahora mismo marca <strong>{disparada.materiales.length}</strong>:{' '}
                {disparada.materiales.slice(0, 4).map((m) => m.nombre).join(', ')}
                {disparada.materiales.length > 4 && ` y ${disparada.materiales.length - 4} más`}.
              </p>
            ) : (
              <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[12.5px] text-muted-foreground">
                Ahora mismo no marca nada.
              </p>
            )}
          </Section>
        );
      })}
    </div>
  );
}
