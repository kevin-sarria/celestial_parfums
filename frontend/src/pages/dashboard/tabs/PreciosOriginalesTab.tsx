import { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { NoSePudoCargar } from '../../../components/NoSePudoCargar';
import { SmartTable } from '../../../components/table/SmartTable';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { EncabezadoPagina, Section } from '../ui';
import { columnasPrecios } from './preciosOriginales/columnas';
import { aplicableEnBloque, cambiaConSugerido, filasDePrecios, type FilaPrecio, type Original } from './preciosOriginales/filas';
import { MetaGanancia } from './preciosOriginales/MetaGanancia';
import { MetaPropiaModal } from './preciosOriginales/MetaPropiaModal';
import { metaValida, type Meta } from './preciosOriginales/sugerencia';

const GUARDADA = 'precios-originales:meta';
/** La meta general se recuerda en ESTE navegador: es una comodidad, no un dato del negocio. */
const leerMeta = (): Meta => {
  try {
    const m = JSON.parse(localStorage.getItem(GUARDADA) ?? '') as Meta;
    if (m && (m.tipo === 'porcentaje' || m.tipo === 'pesos') && metaValida(m)) return m;
  } catch { /* sin guardada, la de siempre */ }
  return { tipo: 'porcentaje', valor: 30 };
};

type Vista = 'todas' | 'sin_precio' | 'bajo_meta';
const VISTAS: { id: Vista; texto: string }[] = [
  { id: 'todas', texto: 'Todas' }, { id: 'sin_precio', texto: 'Sin precio' }, { id: 'bajo_meta', texto: 'Bajo tu meta' },
];
const enVista = (v: Vista) => (f: FilaPrecio) =>
  v === 'todas' || (v === 'sin_precio' ? f.estado === 'Sin precio' : f.estado === 'Bajo tu meta');

/**
 * PRECIOS DE LOS ORIGINALES (dueño, 2026-10-04). Una fila por talla, paginada:
 * la primera versión pintaba una tarjeta por original y con 100 originales
 * eran 400 renglones seguidos (*"que no se extienda infinitamente hacia
 * abajo"*). Diseño en `docs/superpowers/specs/2026-10-04-precios-originales-design.md`.
 */
export function PreciosOriginalesTab() {
  const [originales, setOriginales] = useState<Original[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState('');
  const [meta, setMeta] = useState<Meta>(leerMeta);
  const [vista, setVista] = useState<Vista>('todas');
  const [confirmando, setConfirmando] = useState<FilaPrecio[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [metaDe, setMetaDe] = useState<FilaPrecio | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: Original[] }>(urls.preciosOriginales.lista);
      if (!res.ok) { setFallo(res.error); return; }
      setOriginales(res.cuerpo?.data ?? []); setFallo('');
    } catch { setFallo('No se pudo conectar con el servidor'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { try { localStorage.setItem(GUARDADA, JSON.stringify(meta)); } catch { /* sin almacenamiento */ } }, [meta]);

  const metaUsable = metaValida(meta) ? meta : leerMeta();
  const filas = useMemo(() => filasDePrecios(originales, metaUsable), [originales, metaUsable.tipo, metaUsable.valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuenta = (v: Vista) => filas.filter(enVista(v)).length;
  const visibles = filas.filter(enVista(vista));
  // En bloque nunca se baja un precio: eso se hace de a uno con "Usar"
  const aplicables = visibles.filter(aplicableEnBloque);

  /** Guarda precios y deja la pantalla con lo que devolvió el servidor (no se vuelve a pedir). */
  const guardar = async (lista: { perfume_id: number; presentacion_id: number; precio: number }[]) => {
    setGuardando(true);
    try {
      const res = await http.patch<{ data: Original[]; message?: string }>(urls.preciosOriginales.precios, { precios: lista });
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: 'precios-originales' }); return false; }
      setOriginales(res.cuerpo.data);
      toast.success(res.cuerpo.message ?? 'Precio guardado', { id: 'precios-originales' });
      return true;
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'precios-originales' }); return false; }
    finally { setGuardando(false); }
  };
  const guardarPrecio = (f: FilaPrecio, precio: number) =>
    guardar([{ perfume_id: f.perfume_id, presentacion_id: f.presentacion_id, precio }]);
  // Depende solo de `originales` por el cierre de `guardar`; recrear columnas no remonta celdas
  const columnas = useMemo(() => columnasPrecios(guardarPrecio), [originales]); // eslint-disable-line react-hooks/exhaustive-deps

  const aplicarConfirmados = async () => {
    if (!confirmando) return;
    const ok = await guardar(confirmando.map(f => ({ perfume_id: f.perfume_id, presentacion_id: f.presentacion_id, precio: f.sugerido! })));
    if (ok) setConfirmando(null);
  };

  const ponerMetaPropia = async (m: Meta | null) => {
    if (!metaDe) return false;
    try {
      const res = await http.patch<{ data: Original[]; message?: string }>(urls.preciosOriginales.meta(metaDe.perfume_id), { meta: m });
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: 'meta-propia' }); return false; }
      setOriginales(res.cuerpo.data);
      toast.success(res.cuerpo.message ?? 'Listo', { id: 'meta-propia' });
      return true;
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'meta-propia' }); return false; }
  };

  const sinPrecio = cuenta('sin_precio');
  const bajoMeta = cuenta('bajo_meta');

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Precios de originales" count={filas.length} />

      {/* Franja: lo que cuesta ventas HOY es la cifra grande; la meta vive aquí, no en la tabla */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <span className={cn('font-display text-2xl font-medium tabular-nums', sinPrecio > 0 ? 'text-amber-700' : 'text-foreground')}>{sinPrecio}</span>
            <span className="text-[13px] text-foreground">{sinPrecio === 1 ? 'talla sin precio' : 'tallas sin precio'}</span>
            <span className="text-[12.5px] text-muted-foreground">· no salen en la tienda</span>
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            {bajoMeta} por debajo de tu meta · {cuenta('todas') - sinPrecio - bajoMeta} al día o sin costo
          </p>
        </div>
        <div>
          <MetaGanancia etiqueta="Quiero ganar" meta={meta} onChange={setMeta} />
          {!metaValida(meta) && <p className="mt-1 text-[12px] text-destructive">En porcentaje va de 1 a 90.</p>}
        </div>
      </div>

      <Section>
        {fallo && <NoSePudoCargar que="los originales" onReintentar={cargar} />}
        {cargando && originales.length === 0 ? <PerfumeSpinner /> : (
          <SmartTable
            columns={columnas}
            rows={visibles}
            rowKey={f => f.clave}
            paginadoLocal
            tarjetaMovil
            emptyText={vista === 'todas' ? 'Todavía no hay originales. Entran al registrar la compra de una botella.' : 'Nada en esta vista.'}
            acciones={(
              <>
                <div role="group" aria-label="Qué tallas ver" className="inline-flex rounded-lg border border-border p-0.5">
                  {VISTAS.map(v => (
                    <button key={v.id} type="button" aria-pressed={vista === v.id}
                      className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium',
                        vista === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                      onClick={() => setVista(v.id)}>
                      {v.texto}{v.id !== 'todas' && ` ${cuenta(v.id)}`}
                    </button>
                  ))}
                </div>
                <Button size="sm" disabled={guardando || aplicables.length === 0} onClick={() => setConfirmando(aplicables)}>
                  Poner el sugerido ({aplicables.length})
                </Button>
              </>
            )}
            renderActions={f => (
              <Button variant="ghost" size="icon" className={cn('size-8', f.metaPropia ? 'text-primary' : 'text-muted-foreground')}
                title={`Meta propia de ${f.perfume}`} aria-label={`Meta propia de ${f.perfume}`} onClick={() => setMetaDe(f)}>
                <Target className="size-4" />
              </Button>
            )}
            accionesMovil={f => (
              <>
                {cambiaConSugerido(f) && (
                  <Button size="sm" className="h-11" disabled={guardando} onClick={() => guardarPrecio(f, f.sugerido!)}>
                    Usar {formatPrice(f.sugerido!)}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-11" onClick={() => setMetaDe(f)}>
                  <Target className="size-4" /> Meta propia
                </Button>
              </>
            )}
          />
        )}
      </Section>

      <Modal
        open={confirmando != null}
        onClose={() => setConfirmando(null)}
        title="Poner el precio sugerido"
        onSubmit={e => { e.preventDefault(); aplicarConfirmados(); }}
        submitLabel={guardando ? 'Guardando…' : `Guardar ${confirmando?.length ?? 0} precio(s)`}
        loading={guardando}
        maxWidth={480}
      >
        {confirmando && (
          <p className="text-[13px] text-foreground">
            Se guardan <strong>{confirmando.length}</strong> precio(s) de la vista «{VISTAS.find(v => v.id === vista)?.texto}».
            {confirmando.some(f => f.precio <= 0) && ` ${confirmando.filter(f => f.precio <= 0).length} estaban sin precio y aparecen en la tienda.`}
          </p>
        )}
      </Modal>

      <MetaPropiaModal
        perfume={metaDe?.perfume ?? null}
        metaPropia={metaDe?.metaPropia ?? null}
        metaGeneral={metaUsable}
        onCerrar={() => setMetaDe(null)}
        onGuardar={ponerMetaPropia}
      />
    </div>
  );
}
