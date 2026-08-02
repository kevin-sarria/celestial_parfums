import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, PackageCheck, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { BASE_URL, authFetchWithRefresh } from '../../infrastructure/api/client';
import { GARANTIA } from '../../config/negocio';
import {
  MOTIVOS, etiquetaMotivo, etiquetaSolucionCliente, metaEstado,
} from '../../domain/entities/devolucion.labels';
import type { DevolucionEstado, DevolucionMotivo, DevolucionSolucion } from '../../pages/dashboard/types';

/** Compra del cliente con el avance de sus reclamos. */
export interface MiCompra {
  id: number;
  dia: string;
  valor_venta: number;
  referencia_perfume: string;
  perfumes: { id: number; nombre: string; imagen_url: string | null; cantidad: number }[];
  devoluciones: {
    id: number; fecha: string; motivo: DevolucionMotivo; detalle: string | null;
    estado: DevolucionEstado; solucion: DevolucionSolucion | null;
    monto_devuelto: number; fecha_resolucion: string | null; imagenes: string[];
  }[];
}

const precio = (n: number) => `$ ${n.toLocaleString('es-CO')}`;
/** Fecha AAAA-MM-DD sin `new Date()`: en Colombia mostraría el día anterior. */
const fmt = (s: string) => {
  const [a, m, d] = s.split('-');
  return `${Number(d)}/${Number(m)}/${a}`;
};
const ABIERTA = (e: DevolucionEstado) => e === 'pendiente' || e === 'en_revision';

/**
 * "Mis pedidos" del portal: el cliente ve sus compras y puede abrir un reclamo
 * de garantía con fotos. El caso nace `pendiente` y sin plata — cuánto se
 * devuelve lo decide el admin, nunca el cliente.
 */
export default function MisPedidos() {
  const [compras, setCompras] = useState<MiCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetchWithRefresh(`${BASE_URL}/api/devoluciones/mis-compras`);
      if (!res.ok) throw new Error();
      setCompras((await res.json()).data ?? []);
      setError('');
    } catch {
      setError('No pudimos cargar tus pedidos. Revisa tu conexión y reintenta.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return null;

  return (
    <section className="mt-14">
      <h2 className="flex items-center gap-2 font-display text-2xl font-light text-ink">
        <ShieldCheck className="size-5 text-primary" /> Garantía de mis pedidos
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
        ¿Algo llegó mal? Repórtalo aquí y lo resolvemos. Tus productos tienen{' '}
        <strong className="text-foreground">{GARANTIA.texto}</strong> de garantía —{' '}
        <Link to="/legal#devoluciones" className="font-medium text-primary underline underline-offset-2">
          ver cómo funciona
        </Link>.
      </p>

      {error && (
        <p className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={cargar}>Reintentar</Button>
        </p>
      )}

      {!error && compras.length === 0 && (
        <p className="mt-5 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[13.5px] text-muted-foreground">
          Todavía no tienes pedidos registrados a tu nombre.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {compras.map((c) => {
          const tieneAbierta = c.devoluciones.some((d) => ABIERTA(d.estado));
          return (
            <article key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {c.perfumes.slice(0, 3).map((p) => (
                    p.imagen_url
                      ? <img key={p.id} src={p.imagen_url} alt="" loading="lazy"
                          className="size-11 rounded-lg border border-border bg-white object-contain p-0.5" />
                      : <span key={p.id} className="grid size-11 place-items-center rounded-lg border border-border bg-secondary">
                          <PackageCheck className="size-4 text-muted-foreground" />
                        </span>
                  ))}
                </div>
                <div className="min-w-40 flex-1">
                  <p className="text-[14.5px] font-medium text-foreground">{c.referencia_perfume}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    Pedido del {fmt(c.dia)} · {precio(c.valor_venta)}
                  </p>
                </div>
                {!tieneAbierta && (
                  <Button size="sm" variant="outline" className="rounded-full"
                    onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
                    {abierta === c.id ? 'Cancelar' : 'Reportar un problema'}
                  </Button>
                )}
              </div>

              {/* Avance de los reclamos ya abiertos */}
              {c.devoluciones.map((d) => {
                const meta = metaEstado(d.estado);
                return (
                  <div key={d.id} className="mt-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                      {etiquetaMotivo(d.motivo)}
                      <Badge variant="outline" className={`rounded-full text-[10px] ${meta.clase}`}>{meta.label}</Badge>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">Reportado el {fmt(d.fecha)}</p>
                    {d.detalle && <p className="mt-1 text-[12.5px] text-foreground/80">“{d.detalle}”</p>}
                    {d.imagenes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.imagenes.map((u) => (
                          <img key={u} src={u} alt="" loading="lazy"
                            className="size-14 rounded-lg border border-border object-cover" />
                        ))}
                      </div>
                    )}
                    {d.estado === 'resuelta' && (
                      <p className="mt-1.5 text-[12.5px] font-medium text-emerald-700">
                        {etiquetaSolucionCliente(d.solucion)}
                        {d.monto_devuelto > 0 && ` · ${precio(d.monto_devuelto)}`}
                        {d.fecha_resolucion && ` · ${fmt(d.fecha_resolucion)}`}
                      </p>
                    )}
                    {ABIERTA(d.estado) && (
                      <p className="mt-1.5 text-[12.5px] text-primary">
                        Estamos revisando tu caso. Te escribiremos por WhatsApp.
                      </p>
                    )}
                  </div>
                );
              })}
              {abierta === c.id && (
                <FormularioReclamo compraId={c.id} onListo={() => { setAbierta(null); cargar(); }} />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Formulario para abrir un reclamo sobre una compra concreta. */
function FormularioReclamo({ compraId, onListo }: { compraId: number; onListo: () => void }) {
  const [motivo, setMotivo] = useState<DevolucionMotivo>('llego_danado');
  const [detalle, setDetalle] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const agregar = (files: FileList | null) => {
    if (!files) return;
    // Se copia la lista AQUÍ, no dentro del updater: `files` es un FileList vivo
    // del input y la línea de abajo (que limpia el input para poder volver a
    // elegir la misma foto) lo deja vacío antes de que React ejecute el updater.
    const elegidas = Array.from(files);
    setFotos((f) => [...f, ...elegidas.slice(0, 3 - f.length)]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const enviar = async () => {
    if (!detalle.trim()) { setError('Cuéntanos brevemente qué pasó'); return; }
    setEnviando(true); setError('');
    try {
      const fd = new FormData();
      fd.append('venta_id', String(compraId));
      fd.append('motivo', motivo);
      fd.append('detalle', detalle.trim());
      fotos.forEach((f) => fd.append('imagenes', f));
      const res = await authFetchWithRefresh(`${BASE_URL}/api/devoluciones/solicitar`, {
        method: 'POST', body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error ?? 'No se pudo enviar tu solicitud'); return; }
      onListo();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setEnviando(false); }
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/25 bg-brand-soft/40 px-3.5 py-3.5">
      <p className="text-[13px] font-medium text-foreground">¿Qué pasó con tu pedido?</p>

      <NativeSelect className="mt-2" value={motivo}
        onChange={(e) => setMotivo(e.target.value as DevolucionMotivo)}>
        {MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
      </NativeSelect>

      <Textarea rows={2} maxLength={2000} value={detalle} className="mt-2"
        placeholder="Cuéntanos con tus palabras: qué llegó mal, cómo lo notaste…"
        onChange={(e) => setDetalle(e.target.value)} />

      <div className="mt-2 flex flex-wrap gap-2">
        {fotos.map((f, i) => (
          <div key={i} className="relative size-16">
            <img src={URL.createObjectURL(f)} alt="" className="size-16 rounded-lg border border-border object-cover" />
            <button type="button" aria-label="Quitar"
              className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-background"
              onClick={() => setFotos((n) => n.filter((_, x) => x !== i))}><X className="size-3" /></button>
          </div>
        ))}
        {fotos.length < 3 && (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
            <ImagePlus className="size-5" />
            <span className="text-[10px]">Foto</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => agregar(e.target.files)} />
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        Hasta 3 fotos del producto y del empaque como te llegó. Nos ayudan a resolverlo más rápido.
      </p>

      {error && <p className="mt-2 text-[12.5px] font-medium text-destructive">{error}</p>}

      <Button size="sm" className="mt-3 rounded-full" disabled={enviando} onClick={enviar}>
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </Button>
    </div>
  );
}
