import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, FlaskConical, PackagePlus, Scale, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ExportMenu from '../../../components/ExportMenu';
import ImportModal from '../../../components/ImportModal';
import { SmartTable } from '../../../components/table/SmartTable';
import { BASE_URL } from '../../../infrastructure/api/client';
import { formatPrice } from '../helpers';
import { inventarioColumns } from '../columns';
import { EncabezadoPagina, Field, FieldRow, FranjaMetricas, Section, StatCard } from '../ui';
import { SalidaModal } from './inventario/SalidaModal';
import { mlDiluyente } from '../../../application/costeoCotizacion';
import type { GuardedFetch, InventarioInsumo } from '../types';
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
  const [salidasMes, setSalidasMes] = useState({ muestras: 0, mermas: 0, ajustes: 0 });
  const [importOpen, setImportOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ri, rc, rf, rpf] = await Promise.all([
        guardedFetch(API),
        guardedFetch(`${BASE_URL}/api/costeo/insumos`),
        guardedFetch(`${BASE_URL}/api/costeo/formulas`),
        guardedFetch(`${BASE_URL}/api/parfums`),
      ]);
      if (!ri.ok || !rc.ok || !rf.ok) throw new Error();
      const inv = (await ri.json()).data;
      setInsumos(inv.insumos ?? []);
      setValorTotal(inv.valor_total ?? 0);
      setSalidasMes(inv.salidas_mes ?? { muestras: 0, mermas: 0, ajustes: 0 });
      setCatalogo((await rc.json()).data ?? []);
      setFormulas((await rf.json()).data ?? []);
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
      // Se dice dónde quedó: el historial de lotes ya no vive en esta pantalla
      toast.success(`Lote registrado: ${formatPrice(json.data?.costo_total ?? 0)} en insumos. Lo ves en Producciones.`);
      setProdAbierta(false); load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'prod' }); }
    finally { setGuardando(false); }
  };

  if (loading) return <Section><PerfumeSpinner /></Section>;

  const sinStock = insumos.filter((i) => i.stock <= 0).length;
  /** Los que ya tocaron su punto de pedido: esta es la lista de compras. */
  const porPedir = insumos.filter((i) => i.bajo_minimo);

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Inventario" count={insumos.length} />

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={load}>Reintentar</Button>
        </p>
      )}

      <FranjaMetricas>
        <StatCard label="Valor del inventario" value={formatPrice(valorTotal)}
          nota="Lo que tienes guardado, al costo promedio" />
        <StatCard label="Insumos registrados" value={String(insumos.length)}
          nota="Materias primas, envases y accesorios" />
        <StatCard label="Sin existencias" value={String(sinStock)}
          nota={sinStock === 0 ? 'Todo con stock' : 'Insumos en cero: revisa antes de producir'} />
      </FranjaMetricas>

      {/* Lista de pedido: lo que hay que encargar, con cuánto */}
      {porPedir.length > 0 && (
        <div className="rounded-xl border border-amber-400/45 bg-amber-400/10 px-3.5 py-3">
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
        <p className="rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          Este mes salió material sin venta:
          {salidasMes.muestras > 0 && <> <strong className="text-foreground">{formatPrice(salidasMes.muestras)}</strong> en muestras y mostrario</>}
          {salidasMes.mermas > 0 && <> · <strong className="text-foreground">{formatPrice(salidasMes.mermas)}</strong> en mermas</>}
          {salidasMes.ajustes > 0 && <> · <strong className="text-foreground">{formatPrice(salidasMes.ajustes)}</strong> de diferencia en conteos</>}
          . Las muestras son inversión en vender; las mermas y las diferencias, plata perdida.
        </p>
      )}

      <Section>
        <p className="text-[12.5px] text-muted-foreground">
          El stock entra con las compras a proveedores y sale con la producción. Usa
          <strong className="text-foreground"> Ajustar</strong> para sembrar lo que ya tienes hoy
          o corregir tras un conteo — la diferencia que aparezca es el desperdicio del día a día
          (los gramos que se van de más al servir), no hace falta anotarlos uno por uno.
        </p>

        <SmartTable
          columns={inventarioColumns}
          rows={insumos}
          rowKey={i => i.id}
          numerada
          paginadoLocal
          tarjetaMovil
          emptyText="Todavía no has registrado insumos."
          renderActions={i => (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => abrirAjuste(i)}>
              Ajustar
            </Button>
          )}
          accionesMovil={i => (
            <Button size="sm" variant="outline" onClick={() => abrirAjuste(i)}>
              <Scale className="size-4" /> Ajustar existencias
            </Button>
          )}
          acciones={
            <>
              {/* Excel es mantenimiento: cabe detrás de un clic para no competir
                  con las tres acciones reales del día. Los nombres van en el idioma
                  del dueño, no del sistema: "Movimientos" e "Insumos" no le dicen
                  nada a quien no construyó esto. */}
              <ExportMenu
                guardedFetch={guardedFetch}
                onImportar={() => setImportOpen(true)}
                importarLabel="Subir hoja de conteo"
                descargas={[
                  { entity: 'inventario', label: 'Hoja de conteo', nota: 'Para contar y volver a subirla' },
                  { entity: 'insumos', label: 'Lista de materiales', nota: 'Qué usas y cuánto cuesta' },
                  { entity: 'movimientos', label: 'Historial de entradas y salidas', nota: 'Solo se descarga' },
                ]}
              />
              <Button size="sm" variant="outline" onClick={() => setSalidaAbierta(true)}>
                <Droplets className="size-4" /> Salida
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => { setProdAbierta(true); setFormulaId(formulas[0]?.id ?? ''); }}>
                <FlaskConical className="size-4" /> Producción
              </Button>
              <Button size="sm" asChild>
                <Link to="/dashboard/pagos?nueva=1">
                  <PackagePlus className="size-4" /> Registrar llegada
                </Link>
              </Button>
            </>
          }
        />
      </Section>


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
        <SalidaModal
          insumos={insumos}
          guardedFetch={guardedFetch}
          onClose={() => setSalidaAbierta(false)}
          onGuardado={load}
        />
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
    </div>
  );
}
