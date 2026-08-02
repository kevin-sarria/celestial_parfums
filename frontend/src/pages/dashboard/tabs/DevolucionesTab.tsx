import { useEffect, useState } from 'react';
import { AlertTriangle, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import ExportButton from '../../../components/ExportButton';
import DevolucionForm from '../devoluciones/DevolucionForm';
import { BASE_URL } from '../../../infrastructure/api/client';
import { formatPrice, fmtDate } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import {
  ESTADOS, PLAZO_LEGAL_HABILES, diasHabilesDesde, etiquetaMotivo, etiquetaSolucion, metaEstado,
} from '../../../domain/entities/devolucion.labels';
import type { Devolucion, DevolucionEstado, GuardedFetch } from '../types';

const API = `${BASE_URL}/api/devoluciones`;
const ABIERTA = (e: DevolucionEstado) => e === 'pendiente' || e === 'en_revision';

/**
 * Devoluciones y reclamos de garantía. Cada caso cuelga de una venta: la plata
 * devuelta se descuenta sola de los ingresos del mes (ver `getVentaTotales`),
 * y el contador de días hábiles avisa antes de que se venza el plazo de ley.
 */
export function DevolucionesTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [rows, setRows] = useState<Devolucion[]>([]);
  const [filtro, setFiltro] = useState<'todas' | DevolucionEstado>('todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<Devolucion | null>(null);
  const [abierto, setAbierto] = useState(false);

  const load = async (estado = filtro) => {
    setLoading(true);
    try {
      const r = await guardedFetch(`${API}?estado=${estado}`);
      if (!r.ok) throw new Error();
      setRows((await r.json()).data ?? []);
      setError('');
    } catch {
      setError('No se pudieron cargar las devoluciones. Revisa tu conexión y reintenta.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarEstado = async (d: Devolucion, estado: DevolucionEstado) => {
    const res = await guardedFetch(`${API}/${d.id}/estado`, {
      method: 'PATCH', body: JSON.stringify({ estado }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) { toast.error(json?.error ?? 'No se pudo cambiar el estado', { id: 'dev-estado' }); return; }
    load();
  };

  const eliminar = async (d: Devolucion) => {
    if (!window.confirm(`¿Borrar la devolución #${d.id}? Si tenía dinero devuelto, ese monto vuelve a contar como ingreso.`)) return;
    const res = await guardedFetch(`${API}/${d.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('No se pudo borrar', { id: 'dev-borrar' }); return; }
    toast.success('Devolución borrada');
    load();
  };

  const abiertas = rows.filter((d) => ABIERTA(d.estado)).length;
  const resueltas = rows.filter((d) => d.estado === 'resuelta');
  const devueltoTotal = resueltas.reduce((s, d) => s + d.monto_devuelto, 0);
  /** Lo que de verdad costaron: plata devuelta + producto repuesto + envíos. */
  const costoTotal = resueltas.reduce((s, d) => s + d.costo_total, 0);
  const enProducto = resueltas.reduce((s, d) => s + d.costo_reposicion, 0);
  const enEnvios = resueltas.reduce((s, d) => s + d.costo_envio, 0);

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={rows.length}>Devoluciones y garantías</SectionTitle>
        <ToolbarActions>
          <NativeSelect className="h-9 w-40" value={filtro}
            onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="todas">Todos los estados</option>
            {ESTADOS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </NativeSelect>
          <ExportButton entity="devoluciones" guardedFetch={guardedFetch} />
          <Button size="sm" onClick={() => { setEditando(null); setAbierto(true); }}>
            <Plus className="size-4" /> Registrar devolución
          </Button>
        </ToolbarActions>
      </Toolbar>

      <p className="mb-2 text-[12.5px] text-muted-foreground">
        {abiertas > 0
          ? <>Tienes <strong className="text-foreground">{abiertas}</strong> {abiertas === 1 ? 'caso abierto' : 'casos abiertos'}. </>
          : 'No hay casos abiertos. '}
        Los {formatPrice(devueltoTotal)} devueltos en plata ya están descontados de los ingresos.
      </p>

      {/* Pérdida real: la plata devuelta es solo una parte */}
      {costoTotal > 0 && (
        <p className="mb-4 rounded-lg border border-primary/25 bg-brand-soft/60 px-3.5 py-2.5 text-[13px] text-primary">
          Las garantías te han costado <strong>{formatPrice(costoTotal)}</strong>
          {devueltoTotal > 0 && <> · {formatPrice(devueltoTotal)} devueltos</>}
          {enProducto > 0 && <> · {formatPrice(enProducto)} en producto repuesto</>}
          {enEnvios > 0 && <> · {formatPrice(enEnvios)} en envíos</>}
        </p>
      )}

      {error && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={() => load()}>Reintentar</Button>
        </p>
      )}

      {loading ? <PerfumeSpinner /> : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Sin devoluciones registradas{filtro !== 'todas' ? ' con ese estado' : ''}.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((d) => {
            const meta = metaEstado(d.estado);
            const dias = diasHabilesDesde(d.fecha);
            const vencido = ABIERTA(d.estado) && dias > PLAZO_LEGAL_HABILES;
            const porVencer = ABIERTA(d.estado) && !vencido && dias >= PLAZO_LEGAL_HABILES - 7;
            return (
              <li key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-52 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-foreground">
                      {d.venta?.persona ?? `Venta #${d.venta_id}`}
                      <Badge variant="outline" className={`rounded-full text-[10px] ${meta.clase}`}>{meta.label}</Badge>
                      {d.origen === 'cliente' && (
                        <Badge variant="outline" className="rounded-full border-primary/40 bg-brand-soft text-[10px] text-primary">
                          Lo pidió el cliente
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {etiquetaMotivo(d.motivo)} · reportado el {fmtDate(d.fecha)}
                      {d.venta && <> · venta del {fmtDate(d.venta.dia)} por {formatPrice(d.venta.valor_venta)}</>}
                    </p>
                    {d.detalle && <p className="mt-1 text-[12.5px] text-foreground/80">“{d.detalle}”</p>}
                    {d.perfumes.length > 0 && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Vuelven: {d.perfumes.map((p) => `${p.cantidad}× ${p.nombre}`).join(', ')}
                      </p>
                    )}
                    {d.solucion && (
                      <p className="mt-1 text-[12.5px] text-foreground">
                        {etiquetaSolucion(d.solucion)}
                        {d.monto_devuelto > 0 && <> · <strong>{formatPrice(d.monto_devuelto)}</strong></>}
                        {d.fecha_resolucion && <span className="text-muted-foreground"> · cerrado el {fmtDate(d.fecha_resolucion)}</span>}
                      </p>
                    )}
                    {/* Fotos que subió el cliente al reportar (prueba del reclamo) */}
                    {d.imagenes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.imagenes.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" title="Ver en grande">
                            <img src={u} alt="" loading="lazy"
                              className="size-16 rounded-lg border border-border object-cover transition-opacity hover:opacity-80" />
                          </a>
                        ))}
                      </div>
                    )}
                    {d.notas && <p className="mt-1 text-[12px] italic text-muted-foreground">Nota: {d.notas}</p>}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {ABIERTA(d.estado) && d.estado === 'pendiente' && (
                      <Button size="sm" variant="outline" onClick={() => cambiarEstado(d, 'en_revision')}>
                        Marcar en revisión
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-primary"
                      onClick={() => { setEditando(d); setAbierto(true); }} title="Editar">
                      <Pencil className="size-4" />
                    </Button>
                    {d.estado !== 'pendiente' && (
                      <Button size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-primary"
                        onClick={() => cambiarEstado(d, 'pendiente')} title="Reabrir">
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-destructive"
                      onClick={() => eliminar(d)} title="Borrar">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Reloj del plazo legal: solo aparece cuando de verdad importa */}
                {(vencido || porVencer) && (
                  <p className={`mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${
                    vencido ? 'bg-destructive/10 text-destructive' : 'bg-amber-400/10 text-amber-700'}`}>
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {vencido
                      ? `Llevas ${dias} días hábiles: ya pasaste el plazo de ${PLAZO_LEGAL_HABILES} que da la ley.`
                      : `Llevas ${dias} días hábiles de los ${PLAZO_LEGAL_HABILES} que da la ley. Ciérralo pronto.`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {abierto && (
        <DevolucionForm
          guardedFetch={guardedFetch}
          devolucion={editando}
          onClose={() => setAbierto(false)}
          onGuardada={() => { setAbierto(false); load(); }}
        />
      )}
    </Section>
  );
}
