import { useEffect, useState } from 'react';
import { Boxes, Droplets, FlaskConical, ShoppingCart, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ExportButton from '../../../components/ExportButton';
import ImportModal from '../../../components/ImportModal';
import { BASE_URL } from '../../../infrastructure/api/client';
import { formatPrice, fmtDate } from '../helpers';
import { Field, FieldRow, Section, SectionTitle, StatCard, StatRow, Toolbar, ToolbarActions } from '../ui';
import { mlDiluyente } from '../../../application/costeoCotizacion';
import type { GuardedFetch, InventarioInsumo, Produccion } from '../types';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

/** Lo mínimo que hace falta del catálogo para elegir qué fragancia se armó. */
interface PerfumeLite { id: number; nombre: string; insumo_esencia_id: number | null }

const API = `${BASE_URL}/api/inventario`;
const hoy = () => new Date().toISOString().slice(0, 10);

/** Insumo de la fórmula ubicado por nombre (mismo criterio del motor de costeo). */
const porNombre = (insumos: Insumo[], clave: string) =>
  insumos.find((i) => i.tipo === 'materia_prima'
    && i.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(clave));

/**
 * Inventario de insumos: qué hay, cuánto vale y por dónde se mueve.
 *
 * El stock y el costo promedio NO se teclean: entran por compras y salen por
 * producción. Aquí solo se siembra el arranque (conteo físico) y se registra
 * lo que se arma.
 */
export function InventarioTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [catalogo, setCatalogo] = useState<Insumo[]>([]);
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [producciones, setProducciones] = useState<Produccion[]>([]);
  const [valorTotal, setValorTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ajuste, setAjuste] = useState<InventarioInsumo | null>(null);
  const [cantidadFinal, setCantidadFinal] = useState('');
  const [costoAjuste, setCostoAjuste] = useState('');
  const [minimoAjuste, setMinimoAjuste] = useState('');
  const [prodAbierta, setProdAbierta] = useState(false);
  const [formulaId, setFormulaId] = useState<number | ''>('');
  const [unidades, setUnidades] = useState('10');
  // Qué fragancia se arma: de ahí sale la esencia concreta que se descuenta
  const [perfumes, setPerfumes] = useState<PerfumeLite[]>([]);
  const [perfumeId, setPerfumeId] = useState<number | ''>('');
  const [envaseId, setEnvaseId] = useState<number | ''>('');
  // Salidas sin venta: rolones del mostrario, minis de regalo, derrames
  const [salidaAbierta, setSalidaAbierta] = useState(false);
  const [salidaInsumo, setSalidaInsumo] = useState<number | ''>('');
  const [salidaCantidad, setSalidaCantidad] = useState('');
  const [salidaUnidad, setSalidaUnidad] = useState<'ml' | 'g' | 'l' | 'kg' | 'unidad'>('ml');
  const [salidaMotivo, setSalidaMotivo] = useState<'muestra' | 'merma'>('muestra');
  const [salidaNota, setSalidaNota] = useState('');
  const [salidasMes, setSalidasMes] = useState({ muestras: 0, mermas: 0, ajustes: 0 });
  const [importOpen, setImportOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ri, rc, rf, rp, rpf] = await Promise.all([
        guardedFetch(API),
        guardedFetch(`${BASE_URL}/api/costeo/insumos`),
        guardedFetch(`${BASE_URL}/api/costeo/formulas`),
        guardedFetch(`${API}/producciones`),
        guardedFetch(`${BASE_URL}/api/parfums`),
      ]);
      if (!ri.ok || !rc.ok || !rf.ok || !rp.ok) throw new Error();
      const inv = (await ri.json()).data;
      setInsumos(inv.insumos ?? []);
      setValorTotal(inv.valor_total ?? 0);
      setSalidasMes(inv.salidas_mes ?? { muestras: 0, mermas: 0, ajustes: 0 });
      setCatalogo((await rc.json()).data ?? []);
      setFormulas((await rf.json()).data ?? []);
      setProducciones((await rp.json()).data ?? []);
      // /api/parfums sin paginar responde { data: { data: [...] } }
      const jp = rpf.ok ? await rpf.json() : null;
      const lista = Array.isArray(jp?.data) ? jp.data : (jp?.data?.data ?? []);
      setPerfumes(lista.map((p: any) => ({ id: p.id, nombre: p.nombre, insumo_esencia_id: p.insumo_esencia_id ?? null })));
      setError('');
    } catch {
      setError('No se pudo cargar el inventario. Revisa tu conexión y reintenta.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirAjuste = (i: InventarioInsumo) => {
    setAjuste(i); setCantidadFinal(String(i.stock)); setCostoAjuste(String(i.costo_promedio));
    setMinimoAjuste(String(i.stock_minimo || ''));
  };

  const guardarAjuste = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!ajuste) return;
    setGuardando(true);
    try {
      const res = await guardedFetch(`${API}/ajustes`, {
        method: 'POST',
        body: JSON.stringify({
          insumo_id: ajuste.id,
          cantidad_final: Number(cantidadFinal) || 0,
          costo_unitario: Number(costoAjuste) || 0,
          stock_minimo: Number(minimoAjuste) || 0,
          fecha: hoy(),
          nota: 'Conteo físico',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo ajustar', { id: 'ajuste' }); return; }
      toast.success('Inventario ajustado');
      setAjuste(null); load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'ajuste' }); }
    finally { setGuardando(false); }
  };

  const perfumeElegido = perfumes.find((p) => p.id === perfumeId) ?? null;
  /** Envases disponibles: el mismo tamaño puede llevar el normal o el luxury. */
  const envases = catalogo.filter((i) => i.tipo === 'envase');

  /**
   * Qué consume un lote. La esencia sale del PERFUME elegido (cada fragancia
   * tiene la suya, con su propio costo); solo si el perfume no la tiene
   * asignada se cae a la esencia por defecto del tamaño.
   */
  const consumosDelLote = (f: FormulaVolumen, cant: number) => {
    const lista: { insumo_id: number; cantidad: number }[] = [];
    const suma = (id: number | null | undefined, porUnidad: number) => {
      if (id && porUnidad > 0) lista.push({ insumo_id: id, cantidad: Math.round(porUnidad * cant * 1000) / 1000 });
    };
    const esenciaId = perfumeElegido?.insumo_esencia_id
      ?? f.esencia_insumo_id ?? porNombre(catalogo, 'esencia')?.id;
    suma(esenciaId, f.esencia_ml);
    suma(porNombre(catalogo, 'diluyente')?.id, mlDiluyente(f));
    suma(porNombre(catalogo, 'sellador')?.id, f.sellador_ml);
    suma(porNombre(catalogo, 'feromonas')?.id, f.feromonas_ml);
    suma(envaseId || f.envase_insumo_id, 1);
    (f.accesorios_default ?? []).forEach((a) => suma(a.insumo_id, 1));
    return lista;
  };

  const formulaElegida = formulas.find((f) => f.id === formulaId) ?? null;
  const cant = Number(unidades) || 0;
  const consumos = formulaElegida && cant > 0 ? consumosDelLote(formulaElegida, cant) : [];
  /** El costo sale de los consumos reales, no del costo genérico del tamaño. */
  const costoLote = consumos.reduce((s, c) => {
    const inv = insumos.find((i) => i.id === c.insumo_id);
    return s + (inv?.costo_promedio ?? 0) * c.cantidad;
  }, 0);
  /** Insumos que no alcanzan para el lote: mejor avisar antes de dejar el stock negativo. */
  const faltantes = consumos
    .map((c) => ({ c, inv: insumos.find((i) => i.id === c.insumo_id) }))
    .filter((x) => x.inv && x.inv.stock < x.c.cantidad)
    .map((x) => `${x.inv!.nombre} (tienes ${x.inv!.stock}, necesitas ${x.c.cantidad})`);

  const guardarProduccion = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!formulaElegida || cant <= 0 || consumos.length === 0) {
      toast.error('Elige el tamaño y cuántas unidades armaste', { id: 'prod' }); return;
    }
    setGuardando(true);
    try {
      const res = await guardedFetch(`${API}/producciones`, {
        method: 'POST',
        body: JSON.stringify({
          fecha: hoy(), formula_volumen_id: formulaElegida.id, cantidad: cant, consumos,
          perfume_id: perfumeId || null,
          envase_insumo_id: envaseId || formulaElegida.envase_insumo_id || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo registrar', { id: 'prod' }); return; }
      toast.success(`Lote registrado: ${formatPrice(json.data?.costo_total ?? 0)} en insumos`);
      setProdAbierta(false); load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'prod' }); }
    finally { setGuardando(false); }
  };

  const guardarSalida = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!salidaInsumo || !(Number(salidaCantidad) > 0)) {
      toast.error('Elige el insumo y cuánto salió', { id: 'salida' }); return;
    }
    setGuardando(true);
    try {
      const res = await guardedFetch(`${API}/salidas`, {
        method: 'POST',
        body: JSON.stringify({
          insumo_id: salidaInsumo, cantidad: Number(salidaCantidad),
          unidad: salidaUnidad, motivo: salidaMotivo, fecha: hoy(),
          nota: salidaNota.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo registrar', { id: 'salida' }); return; }
      toast.success(`Salida registrada: ${formatPrice(json.data?.costo ?? 0)}`);
      setSalidaAbierta(false); setSalidaCantidad(''); setSalidaNota(''); load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'salida' }); }
    finally { setGuardando(false); }
  };

  const borrarProduccion = async (p: Produccion) => {
    if (!window.confirm(`¿Borrar el lote de ${p.cantidad} × ${p.volumen_nombre}? Los insumos vuelven al inventario.`)) return;
    const res = await guardedFetch(`${API}/producciones/${p.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('No se pudo borrar', { id: 'prod-del' }); return; }
    load();
  };

  if (loading) return <Section><PerfumeSpinner /></Section>;

  const sinStock = insumos.filter((i) => i.stock <= 0).length;
  /** Los que ya tocaron su punto de pedido: esta es la lista de compras. */
  const porPedir = insumos.filter((i) => i.bajo_minimo);

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={insumos.length}>Inventario</SectionTitle>
        <ToolbarActions>
          {/* La hoja de conteo es la forma cómoda de sembrar el stock inicial */}
          <ExportButton entity="inventario" guardedFetch={guardedFetch} label="Hoja de conteo" />
          <ExportButton entity="insumos" guardedFetch={guardedFetch} label="Insumos" />
          <ExportButton entity="movimientos" guardedFetch={guardedFetch} label="Movimientos" />
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Importar conteo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSalidaAbierta(true)}>
            <Droplets className="size-4" /> Registrar salida
          </Button>
          <Button size="sm" onClick={() => { setProdAbierta(true); setFormulaId(formulas[0]?.id ?? ''); }}>
            <FlaskConical className="size-4" /> Registrar producción
          </Button>
        </ToolbarActions>
      </Toolbar>

      {error && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={load}>Reintentar</Button>
        </p>
      )}

      <StatRow>
        <StatCard label="Valor del inventario" value={formatPrice(valorTotal)} />
        <StatCard label="Insumos registrados" value={String(insumos.length)} />
        <StatCard label="Sin existencias" value={String(sinStock)} />
      </StatRow>

      {/* Lista de pedido: lo que hay que encargar, con cuánto */}
      {porPedir.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/45 bg-amber-400/10 px-3.5 py-3">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-amber-800">
            <ShoppingCart className="size-4" />
            Hora de pedir: {porPedir.length} {porPedir.length === 1 ? 'insumo está' : 'insumos están'} en el mínimo
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-amber-900">
            {porPedir.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{i.nombre}</strong> — te quedan {i.stock} {i.unidad}
                  <span className="text-amber-700"> (mínimo {i.stock_minimo})</span>
                </span>
                <span className="font-medium">Pide ~{i.sugerido} {i.unidad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lo que se fue sin vender: muestras es marketing, merma es pérdida */}
      {(salidasMes.muestras > 0 || salidasMes.mermas > 0 || salidasMes.ajustes > 0) && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          Este mes salió material sin venta:
          {salidasMes.muestras > 0 && <> <strong className="text-foreground">{formatPrice(salidasMes.muestras)}</strong> en muestras y mostrario</>}
          {salidasMes.mermas > 0 && <> · <strong className="text-foreground">{formatPrice(salidasMes.mermas)}</strong> en mermas</>}
          {salidasMes.ajustes > 0 && <> · <strong className="text-foreground">{formatPrice(salidasMes.ajustes)}</strong> de diferencia en conteos</>}
          . Las muestras son inversión en vender; las mermas y las diferencias, plata perdida.
        </p>
      )}

      <p className="mb-3 mt-5 text-[12.5px] text-muted-foreground">
        El stock entra con las compras a proveedores y sale con la producción. Usa
        <strong className="text-foreground"> Ajustar</strong> para sembrar lo que ya tienes hoy
        o corregir tras un conteo — la diferencia que aparezca es el desperdicio del día a día
        (los gramos que se van de más al servir), no hace falta anotarlos uno por uno.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Insumo</th>
              <th className="py-2 pr-3 text-right font-semibold">Existencias</th>
              <th className="py-2 pr-3 text-right font-semibold">Mínimo</th>
              <th className="py-2 pr-3 text-right font-semibold">Costo promedio</th>
              <th className="py-2 pr-3 text-right font-semibold">Valor</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {insumos.map((i) => (
              <tr key={i.id} className="border-b border-border/60">
                <td className="py-2 pr-3 text-foreground">
                  {i.nombre}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">{i.tipo.replace('_', ' ')}</span>
                </td>
                <td className={`py-2 pr-3 text-right tabular-nums ${i.bajo_minimo || i.stock <= 0 ? 'font-medium text-amber-700' : 'text-foreground'}`}>
                  {i.stock} {i.unidad}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {i.stock_minimo > 0 ? i.stock_minimo : '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{formatPrice(i.costo_promedio)}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium text-foreground">{formatPrice(i.valor)}</td>
                <td className="py-2 text-right">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => abrirAjuste(i)}>Ajustar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lotes armados */}
      <h3 className="mb-2 mt-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Boxes className="size-3.5" /> Producciones recientes
      </h3>
      {producciones.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">Todavía no has registrado lotes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {producciones.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
              <span className="min-w-32 flex-1 text-[13.5px] text-foreground">
                {p.cantidad} × {p.perfume_nombre ? `${p.perfume_nombre} ${p.volumen_nombre}` : p.volumen_nombre}
                <span className="ml-2 text-[12px] text-muted-foreground">{fmtDate(p.fecha)}</span>
              </span>
              <span className="text-[12.5px] text-muted-foreground">
                {formatPrice(p.costo_unitario)} c/u · total <strong className="text-foreground">{formatPrice(p.costo_total)}</strong>
              </span>
              <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => borrarProduccion(p)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Ajuste por conteo físico */}
      {ajuste && (
        <Modal open onClose={() => setAjuste(null)} title={`Ajustar ${ajuste.nombre}`}
          onSubmit={guardarAjuste} submitLabel={guardando ? 'Guardando…' : 'Ajustar'} loading={guardando}>
          <p className="text-[13px] text-muted-foreground">
            Escribe cuánto tienes <strong className="text-foreground">de verdad</strong>. El sistema calcula
            la diferencia y la registra como movimiento.
          </p>
          <FieldRow>
            <Field label={`Cantidad real (${ajuste.unidad})`}>
              <Input type="number" min="0" step="0.001" value={cantidadFinal}
                onChange={(e) => setCantidadFinal(e.target.value)} />
            </Field>
            <Field label="Costo por unidad">
              <Input type="number" min="0" step="0.0001" value={costoAjuste}
                onChange={(e) => setCostoAjuste(e.target.value)} />
            </Field>
            <Field label="Avísame cuando baje de">
              <Input type="number" min="0" step="0.001" value={minimoAjuste}
                placeholder="0 = sin aviso"
                onChange={(e) => setMinimoAjuste(e.target.value)} />
            </Field>
          </FieldRow>
          <p className="text-[12px] text-muted-foreground">
            El punto de pedido se guarda aunque no cambies la cantidad. Ponle lo que gastas
            entre un pedido y otro, con algo de margen: así te avisa con tiempo de encargar.
          </p>
          <p className="text-[12px] text-muted-foreground">
            El costo solo se usa si el ajuste <strong>suma</strong> material (por ejemplo al cargar el
            stock inicial). Si estás quitando, se valora al promedio que ya tiene.
          </p>
        </Modal>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="inventario"
        guardedFetch={guardedFetch}
        onImported={load}
      />

      {/* Salida sin venta: mostrario, regalos, derrames */}
      {salidaAbierta && (
        <Modal open onClose={() => setSalidaAbierta(false)} title="Registrar salida de material"
          onSubmit={guardarSalida} submitLabel={guardando ? 'Guardando…' : 'Registrar'} loading={guardando}>
          <p className="text-[13px] text-muted-foreground">
            Material que sale <strong className="text-foreground">sin que haya venta</strong>: los
            rolones del mostrario, los minis que regalas, o algo que se derramó. Se valora al
            costo promedio del insumo.
          </p>

          <Field label="¿Qué insumo?">
            <BuscadorSelect
              value={salidaInsumo}
              placeholder="— Elige el insumo —"
              opciones={insumos.map((i) => ({
                id: i.id, nombre: `${i.nombre} · quedan ${i.stock} ${i.unidad}`,
              }))}
              onSelect={(id) => {
                setSalidaInsumo(Number(id));
                const inv = insumos.find((x) => x.id === Number(id));
                setSalidaUnidad(inv?.unidad === 'ml' ? 'ml' : 'unidad');
              }}
            />
          </Field>

          <FieldRow>
            <Field label="¿Cuánto salió?">
              <Input type="number" min="0" step="0.001" value={salidaCantidad}
                onChange={(e) => setSalidaCantidad(e.target.value)} />
            </Field>
            <Field label="Unidad">
              <NativeSelect value={salidaUnidad}
                onChange={(e) => setSalidaUnidad(e.target.value as typeof salidaUnidad)}>
                <option value="ml">ml</option>
                <option value="g">gramos</option>
                <option value="l">litros</option>
                <option value="kg">kilos</option>
                <option value="unidad">unidades</option>
              </NativeSelect>
            </Field>
            <Field label="¿Por qué?">
              <NativeSelect value={salidaMotivo}
                onChange={(e) => setSalidaMotivo(e.target.value as typeof salidaMotivo)}>
                <option value="muestra">Muestra / mostrario / regalo</option>
                <option value="merma">Se derramó o dañó</option>
              </NativeSelect>
            </Field>
          </FieldRow>

          <Field label="Nota (opcional)">
            <Input value={salidaNota} maxLength={255}
              placeholder="Ej: rolones de la esencia nueva para el mostrador"
              onChange={(e) => setSalidaNota(e.target.value)} />
          </Field>

          <p className="text-[12px] text-muted-foreground">
            {salidaMotivo === 'muestra'
              ? 'Las muestras cuentan como inversión en vender, no como pérdida: se llevan aparte para que veas cuánto te cuesta dar a probar.'
              : 'Las mermas son plata perdida. Los gramos que se van de más al servir no hace falta anotarlos: los recoge el conteo físico.'}
          </p>
        </Modal>
      )}

      {/* Registrar un lote */}
      {prodAbierta && (
        <Modal open onClose={() => setProdAbierta(false)} title="Registrar producción"
          onSubmit={guardarProduccion} submitLabel={guardando ? 'Guardando…' : 'Registrar lote'} loading={guardando}>
          {/* La fragancia decide qué esencia se descuenta: cada una cuesta distinto */}
          <Field label="¿Qué fragancia armaste?">
            <BuscadorSelect
              value={perfumeId}
              placeholder="— Elige el perfume —"
              opciones={[
                { id: '', nombre: '— Sin especificar (usa la esencia del tamaño) —' },
                ...perfumes.map((p) => ({
                  id: p.id,
                  nombre: p.insumo_esencia_id ? p.nombre : `${p.nombre} · sin esencia asignada`,
                })),
              ]}
              onSelect={(id) => setPerfumeId(id === '' ? '' : Number(id))}
            />
            {perfumeElegido && !perfumeElegido.insumo_esencia_id && (
              <p className="mt-1 text-[12px] font-medium text-amber-700">
                Este perfume no tiene esencia asignada: se descontará la del tamaño y el costo
                será aproximado. Asígnasela en su ficha del catálogo.
              </p>
            )}
          </Field>

          <FieldRow>
            <Field label="¿Qué tamaño armaste?">
              <NativeSelect value={formulaId} onChange={(e) => setFormulaId(Number(e.target.value))}>
                {formulas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </NativeSelect>
            </Field>
            <Field label="¿Cuántas unidades?">
              <Input type="number" min="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Envase usado">
            <NativeSelect value={envaseId || formulaElegida?.envase_insumo_id || ''}
              onChange={(e) => setEnvaseId(Number(e.target.value) || '')}>
              <option value="">— El del tamaño —</option>
              {envases.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </NativeSelect>
            <p className="mt-1 text-[12px] text-muted-foreground">
              El mismo tamaño puede llevar el envase normal o el luxury; cámbialo si usaste otro.
            </p>
          </Field>

          {consumos.length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Se descontará del inventario
              </p>
              <ul className="mt-1.5 space-y-1 text-[12.5px]">
                {consumos.map((c) => {
                  const inv = insumos.find((i) => i.id === c.insumo_id);
                  return (
                    <li key={c.insumo_id} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{inv?.nombre ?? `Insumo ${c.insumo_id}`}</span>
                      <span className="tabular-nums text-foreground">
                        {c.cantidad} {inv?.unidad ?? ''}
                        <span className="ml-1.5 text-muted-foreground">(quedan {((inv?.stock ?? 0) - c.cantidad).toFixed(1)})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 border-t border-border/70 pt-1.5 text-[12.5px]">
                Costo del lote: <strong className="text-primary">{formatPrice(costoLote)}</strong>
              </p>
            </div>
          )}

          {faltantes.length > 0 && (
            <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
              No te alcanza para este lote: {faltantes.join(' · ')}. Puedes registrarlo igual, pero
              el stock quedará en negativo.
            </p>
          )}
        </Modal>
      )}
    </Section>
  );
}
