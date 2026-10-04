import { useEffect, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { NoSePudoCargar } from '../../../components/NoSePudoCargar';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Section, SectionTitle, Toolbar } from '../ui';
import { MetaGanancia } from './preciosOriginales/MetaGanancia';
import { claveTalla, OriginalCard, type Original } from './preciosOriginales/OriginalCard';
import { metaValida, precioSugerido, type Meta } from './preciosOriginales/sugerencia';

const GUARDADA = 'precios-originales:meta';
/** La meta general se recuerda en ESTE navegador: es una comodidad, no un dato del negocio. */
const leerMeta = (): Meta => {
  try {
    const m = JSON.parse(localStorage.getItem(GUARDADA) ?? '') as Meta;
    if (m && (m.tipo === 'porcentaje' || m.tipo === 'pesos') && metaValida(m)) return m;
  } catch { /* sin guardada, la de siempre */ }
  return { tipo: 'porcentaje', valor: 30 };
};

/**
 * PRECIOS DE LOS ORIGINALES (dueño, 2026-10-04): lo que cuesta cada talla de
 * verdad y el precio que deja la ganancia que él elija, para ponérselo a una o
 * a todas de una vez. Diseño en
 * `docs/superpowers/specs/2026-10-04-precios-originales-design.md`.
 */
export function PreciosOriginalesTab() {
  const [originales, setOriginales] = useState<Original[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState('');
  const [meta, setMeta] = useState<Meta>(leerMeta);
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

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

  /** Cada talla con su sugerido, con la meta que le toca (la propia manda). */
  const sugeridos = useMemo(() => originales.flatMap(o => o.tallas.map(t => ({
    clave: claveTalla(o.id, t.presentacion_id), perfume_id: o.id, presentacion_id: t.presentacion_id,
    precio: t.precio, sugerido: precioSugerido(t.costo?.total ?? null, o.meta ?? meta),
  }))), [originales, meta]);
  const sinPrecio = sugeridos.filter(s => s.precio <= 0 && s.sugerido != null);
  const aGuardar = sugeridos.filter(s => marcadas.has(s.clave) && s.sugerido != null && s.sugerido !== s.precio);

  const visibles = soloSinPrecio ? originales.filter(o => o.tallas.some(t => t.precio <= 0)) : originales;

  const marcar = (clave: string) => setMarcadas(m => { const n = new Set(m); if (!n.delete(clave)) n.add(clave); return n; });

  const aplicar = async (lista: typeof sugeridos) => {
    if (lista.length === 0) return;
    if (!window.confirm(`Se van a guardar ${lista.length} precio(s). Las tallas que estaban sin precio aparecen en la tienda. ¿Seguimos?`)) return;
    setGuardando(true);
    try {
      const res = await http.patch<{ data: Original[]; message?: string }>(urls.preciosOriginales.precios, {
        precios: lista.map(s => ({ perfume_id: s.perfume_id, presentacion_id: s.presentacion_id, precio: s.sugerido })),
      });
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: 'precios-originales' }); return; }
      setOriginales(res.cuerpo.data); setMarcadas(new Set());
      toast.success(res.cuerpo.message ?? 'Precios guardados', { id: 'precios-originales' });
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'precios-originales' }); }
    finally { setGuardando(false); }
  };

  const ponerMeta = (id: number) => async (m: Meta | null) => {
    try {
      const res = await http.patch<{ data: Original[]; message?: string }>(urls.preciosOriginales.meta(id), { meta: m });
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: 'meta-propia' }); return false; }
      setOriginales(res.cuerpo.data);
      toast.success(res.cuerpo.message ?? 'Listo', { id: 'meta-propia' });
      return true;
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'meta-propia' }); return false; }
  };

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={originales.length}>Precios de originales</SectionTitle>
      </Toolbar>
      <div className="-mt-1 mb-4 space-y-3 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3">
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-primary">
          <Calculator className="mt-0.5 size-4 shrink-0" />
          <span>
            Lo que te cuesta cada talla (el líquido, lo que se pierde al trasvasar, el frasco y el empaque) y el precio
            que deja la ganancia que elijas, redondeado a $1.000. Un original con meta propia usa la suya.
          </span>
        </p>
        <MetaGanancia etiqueta="Quiero ganar" meta={meta} onChange={setMeta} />
        {!metaValida(meta) && <p className="text-[12.5px] text-destructive">En porcentaje va de 1 a 90.</p>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="mr-auto flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" className="size-4 accent-primary" checked={soloSinPrecio} onChange={e => setSoloSinPrecio(e.target.checked)} />
          Solo los que tienen tallas sin precio
        </label>
        <Button size="sm" variant="outline" disabled={guardando || aGuardar.length === 0} onClick={() => aplicar(aGuardar)}>
          Poner el sugerido a los marcados ({aGuardar.length})
        </Button>
        <Button size="sm" disabled={guardando || sinPrecio.length === 0} onClick={() => aplicar(sinPrecio)}>
          Ponerle precio a todos los que no tienen ({sinPrecio.length})
        </Button>
      </div>

      {fallo && <NoSePudoCargar que="los originales" onReintentar={cargar} />}
      {cargando && originales.length === 0 && <PerfumeSpinner />}
      {!cargando && !fallo && visibles.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          {soloSinPrecio ? 'Todos los originales tienen precio en todas sus tallas.' : 'Todavía no hay originales. Entran al registrar la compra de una botella.'}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3">
        {visibles.map(o => (
          <OriginalCard key={o.id} original={o} metaGeneral={meta} marcadas={marcadas} onMarcar={marcar} onMeta={ponerMeta(o.id)} />
        ))}
      </div>
    </Section>
  );
}
