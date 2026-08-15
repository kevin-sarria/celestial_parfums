import { useEffect, useState } from 'react';
import { Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Modal from '../../../components/Modal';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { EncabezadoPagina, Section, Field, FieldRow } from '../ui';
import { mlDiluyente } from '../../../application/costeoCotizacion';
import type { EscalaPrecio, FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

const formVacio = {
  nombre: '', ml_total: '', esencia_ml: '', sellador_ml: '0', feromonas_ml: '0',
  envase_insumo_id: '' as string,
};
const escalaVacia = { cantidad_min: '', cantidad_max: '', precio: '' };

/**
 * Tamaños fabricables (30/50/100 ml…) con su fórmula y sus precios mayoristas
 * por rango de cantidad. El diluyente nunca se teclea: es el resto del volumen.
 */
export function FormulasVolumenTab() {
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [form, setForm] = useState(formVacio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Editor de rangos de precio: qué fórmula lo tiene abierto y, si se está
  // editando uno existente, su id (null = alta nueva).
  const [escalaDe, setEscalaDe] = useState<number | null>(null);
  const [escalaEditId, setEscalaEditId] = useState<number | null>(null);
  const [escala, setEscala] = useState(escalaVacia);

  // Siempre en finally: si una llamada falla (sin conexión, 429…) la vista
  // NO puede quedarse cargando para siempre; hay que mostrar el error.
  const load = async () => {
    setLoading(true);
    try {
      const [rf, ri] = await Promise.all([
        http.get<{ data?: FormulaVolumen[] }>(urls.costeo.formulas),
        http.get<{ data?: Insumo[] }>(urls.costeo.insumos),
      ]);
      if (!rf.ok || !ri.ok) { setError(rf.error || ri.error); return; }
      setFormulas(rf.cuerpo?.data ?? []);
      setInsumos(ri.cuerpo?.data ?? []);
      setError('');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const envases = insumos.filter((i) => i.tipo === 'envase');

  /** Materias primas que alguna receta usa pero que no tienen costo registrado. */
  const faltanMaterias = (() => {
    const registrada = (clave: string) =>
      insumos.some((i) => i.tipo === 'materia_prima'
        && i.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(clave));
    const usa = (campo: 'sellador_ml' | 'feromonas_ml') => formulas.some((f) => Number(f[campo]) > 0);
    const faltan: string[] = [];
    if (formulas.some((f) => f.diluyente_ml > 0) && !registrada('diluyente')) faltan.push('diluyente');
    if (usa('sellador_ml') && !registrada('sellador')) faltan.push('sellador');
    if (usa('feromonas_ml') && !registrada('feromonas')) faltan.push('feromonas');
    if (formulas.some((f) => Number(f.esencia_ml) > 0) && !registrada('esencia')) faltan.push('esencia');
    return faltan;
  })();

  const abrirNuevo = () => { setForm(formVacio); setError(''); setModal({ open: true, id: null }); };
  const abrirEditar = (f: FormulaVolumen) => {
    setForm({
      nombre: f.nombre, ml_total: String(f.ml_total), esencia_ml: String(f.esencia_ml),
      sellador_ml: String(f.sellador_ml), feromonas_ml: String(f.feromonas_ml),
      envase_insumo_id: f.envase_insumo_id ? String(f.envase_insumo_id) : '',
    });
    setError(''); setModal({ open: true, id: f.id });
  };

  // Diluyente en vivo mientras se teclea (mismo cálculo que el motor de costeo)
  const previoDiluyente = mlDiluyente({
    ml_total: Number(form.ml_total) || 0,
    esencia_ml: Number(form.esencia_ml) || 0,
    sellador_ml: Number(form.sellador_ml) || 0,
    feromonas_ml: Number(form.feromonas_ml) || 0,
  });
  const sobrepasa =
    (Number(form.esencia_ml) || 0) + (Number(form.sellador_ml) || 0) + (Number(form.feromonas_ml) || 0)
    > (Number(form.ml_total) || 0);

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('Ponle un nombre (ej: 30 ml)'); return; }
    if (!Number(form.ml_total)) { setError('Indica el volumen total en ml'); return; }
    if (sobrepasa) { setError('La suma de esencia, sellador y feromonas supera el volumen total'); return; }
    setSaving(true); setError('');
    try {
      const cuerpo = {
        nombre: form.nombre.trim(),
        ml_total: Number(form.ml_total),
        esencia_ml: Number(form.esencia_ml) || 0,
        sellador_ml: Number(form.sellador_ml) || 0,
        feromonas_ml: Number(form.feromonas_ml) || 0,
        envase_insumo_id: form.envase_insumo_id ? Number(form.envase_insumo_id) : null,
      };
      const res = modal.id
        ? await http.patch(urls.costeo.formula(modal.id), cuerpo)
        : await http.post(urls.costeo.crearFormula, cuerpo);
      if (!res.ok) { setError(res.error); return; }
      setModal({ open: false, id: null }); load();
    } finally { setSaving(false); }
  };

  const eliminar = async (f: FormulaVolumen) => {
    if (!window.confirm(`¿Eliminar el tamaño "${f.nombre}" y sus precios mayoristas?`)) return;
    const res = await http.borrar(urls.costeo.formula(f.id));
    // El servidor explica el motivo real (suele ser que una cotización lo usa).
    if (!res.ok) { toast.error(res.error, { id: 'formulas' }); return; }
    load();
  };

  /** Crea o edita un rango, según haya un id en edición. */
  const guardarEscala = async (formulaId: number) => {
    const min = Number(escala.cantidad_min);
    const max = escala.cantidad_max ? Number(escala.cantidad_max) : null;
    const precio = Number(escala.precio);
    // Se avisa ANTES de llamar al servidor: el usuario debe saber qué corregir.
    if (!min || min < 1) { toast.error('Escribe desde qué cantidad aplica el precio', { id: 'Escribe desde qué cantidad aplica el precio' }); return; }
    if (isNaN(precio) || precio < 0) { toast.error('Escribe un precio válido', { id: 'Escribe un precio válido' }); return; }
    if (max !== null && max < min) { toast.error('La cantidad máxima no puede ser menor que la mínima', { id: 'La cantidad máxima no puede ser menor que la mínima' }); return; }

    const cuerpo = { formula_volumen_id: formulaId, cantidad_min: min, cantidad_max: max, precio };
    const res = escalaEditId != null
      ? await http.patch(urls.costeo.escala(escalaEditId), cuerpo)
      : await http.post(urls.costeo.escalas, cuerpo);
    // Si el servidor rechaza, se muestra SU mensaje (no se pierde en la consola).
    // El id fijo hace que el mismo error se reemplace en vez de apilarse.
    if (!res.ok) { toast.error(res.error, { id: 'escalas' }); return; }
    const editando = escalaEditId != null;
    cerrarEditorEscala(); load();
    toast.success(editando ? 'Rango de precio actualizado' : 'Rango de precio agregado');
  };

  /** Abre el editor con los valores del rango (o vacío para uno nuevo). */
  const abrirEditorEscala = (formulaId: number, e?: EscalaPrecio) => {
    setEscalaDe(formulaId);
    setEscalaEditId(e?.id ?? null);
    setEscala(e
      ? { cantidad_min: String(e.cantidad_min), cantidad_max: e.cantidad_max != null ? String(e.cantidad_max) : '', precio: String(e.precio) }
      : escalaVacia);
  };

  const cerrarEditorEscala = () => {
    setEscalaDe(null); setEscalaEditId(null); setEscala(escalaVacia);
  };

  /** Frase de confirmación mientras se teclea, para no confundir precio y cantidad. */
  const vistaPreviaEscala = (() => {
    const min = Number(escala.cantidad_min);
    const max = escala.cantidad_max ? Number(escala.cantidad_max) : null;
    const precio = Number(escala.precio);
    if (!min || !precio) return '';
    const cuantos = max ? `entre ${min} y ${max} unidades` : `${min} unidades o más`;
    return `Llevando ${cuantos}, cada perfume le sale en ${formatPrice(precio)} (${formatPrice(precio * min)} por ${min}).`;
  })();

  /** Un "desde" enorme suele ser el precio tecleado en la casilla equivocada. */
  const cantidadSospechosa = Number(escala.cantidad_min) >= 1000;

  const borrarEscala = async (id: number) => {
    const res = await http.borrar(urls.costeo.escala(id));
    if (!res.ok) { toast.error(res.error, { id: 'escalas' }); return; }
    load();
  };

  if (loading) return <Section><PerfumeSpinner /></Section>;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Tamaños y fórmulas" count={formulas.length}>
        <Button size="sm" onClick={abrirNuevo}><Plus className="size-4" /> Nuevo tamaño</Button>
      </EncabezadoPagina>

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Define cada tamaño que fabricas y su receta. El <strong>diluyente se calcula solo</strong>
          {' '}(es lo que sobra del volumen). Abajo de cada tamaño pones los{' '}
          <strong>precios mayoristas por cantidad</strong>: al cotizar, el sistema sugiere el precio
          según cuántas unidades pida el cliente de ESE producto.
        </span>
      </p>

      {/* Si una materia prima de la receta no está registrada, su costo cuenta 0
          y la ganancia saldría inflada. Mejor decirlo que dar un número falso. */}
      {faltanMaterias.length > 0 && (
        <p className="mb-4 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3.5 py-3 text-[13px] leading-relaxed text-amber-800">
          <strong>Falta registrar el costo de: {faltanMaterias.join(', ')}.</strong> Mientras no
          estén en "Costos de producción" cuentan como $0, así que tu costo real es más alto
          del que ves y la ganancia calculada sale inflada.
        </p>
      )}

      {error && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={() => load()}>Reintentar</Button>
        </p>
      )}

      {formulas.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          {error ? 'No se pudo cargar la lista.' : 'Aún no hay tamaños. Crea el primero (ej: 30 ml).'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {formulas.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-40 flex-1">
                  <p className="text-[15px] font-medium text-foreground">{f.nombre}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    Para armar <strong className="font-medium text-foreground">un</strong> frasco
                    de {f.ml_total} ml
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEditar(f)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => eliminar(f)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {/* La receta era un párrafo corrido ("esencia 15 · diluyente 14.3 ·
                  sellador 0.4…") y no se podía leer de un vistazo. En rejilla,
                  cada ingrediente tiene su etiqueta y su cantidad alineada. */}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {[
                  { t: 'Esencia', v: f.esencia_ml },
                  { t: 'Diluyente', v: f.diluyente_ml },
                  { t: 'Sellador', v: f.sellador_ml },
                  { t: 'Feromonas', v: f.feromonas_ml },
                ].map((i) => (
                  <div key={i.t} className="rounded-lg bg-secondary/50 px-2.5 py-1.5">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{i.t}</dt>
                    <dd className="text-[13.5px] font-medium tabular-nums text-foreground">{i.v} ml</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                <span className="text-muted-foreground">
                  Envase:{' '}
                  <span className={f.envase_nombre ? 'text-foreground' : 'font-medium text-amber-700'}>
                    {f.envase_nombre ?? 'sin elegir'}
                  </span>
                </span>
              </div>

              {/* Escalas de precio mayorista */}
              <div className="mt-3 border-t border-border/70 pt-3">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Precios por cantidad
                </p>
                <p className="mb-2 text-[12px] text-muted-foreground">
                  Cuántas unidades lleva el cliente → cuánto le cobras por cada una.
                </p>
                {f.escalas.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">Sin precios mayoristas definidos.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {f.escalas.map((e) => (
                      <li key={e.id}
                        className={`flex items-center gap-2 rounded-full border py-1 pl-3 pr-1.5 text-[12.5px] ${
                          escalaEditId === e.id ? 'border-primary bg-brand-soft' : 'border-border bg-secondary/50'
                        }`}>
                        <span className="text-foreground">
                          {e.cantidad_max ? `${e.cantidad_min} a ${e.cantidad_max}` : `${e.cantidad_min}+`} unidades →{' '}
                          <strong className="font-semibold text-primary">{formatPrice(e.precio)}</strong>
                          <span className="text-muted-foreground"> c/u</span>
                        </span>
                        {/* Editar en vez de borrar y volver a crear */}
                        <button type="button" aria-label="Editar rango" className="text-muted-foreground hover:text-primary"
                          onClick={() => abrirEditorEscala(f.id, e)}>
                          <Pencil className="size-3.5" />
                        </button>
                        <button type="button" aria-label="Quitar" className="text-muted-foreground hover:text-destructive"
                          onClick={() => borrarEscala(e.id)}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {escalaDe === f.id ? (
                  /* Editor redactado como una frase: así se entiende qué va en
                     cada casilla sin tener que adivinar (antes se confundía la
                     cantidad con el precio). */
                  <div className="mt-3 rounded-xl border border-primary/30 bg-brand-soft/40 p-3.5">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-foreground">
                      <span>Si el cliente lleva desde</span>
                      <div className="relative">
                        <Input type="number" min="1" className="h-9 w-24 pr-8 text-center" placeholder="10"
                          value={escala.cantidad_min}
                          onChange={(e) => setEscala((s) => ({ ...s, cantidad_min: e.target.value }))} />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">u</span>
                      </div>
                      <span>hasta</span>
                      <div className="relative">
                        <Input type="number" min="1" className="h-9 w-28 pr-8 text-center" placeholder="sin tope"
                          value={escala.cantidad_max}
                          onChange={(e) => setEscala((s) => ({ ...s, cantidad_max: e.target.value }))} />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">u</span>
                      </div>
                      <span>, le cobras</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
                        <Input type="number" min="0" className="h-9 w-32 pl-6 text-center" placeholder="19000"
                          value={escala.precio}
                          onChange={(e) => setEscala((s) => ({ ...s, precio: e.target.value }))} />
                      </div>
                      <span>por cada uno.</span>
                    </div>

                    {/* Vista previa en palabras: confirma que entendió bien */}
                    {vistaPreviaEscala && (
                      <p className="mt-2.5 text-[12.5px] text-primary">{vistaPreviaEscala}</p>
                    )}
                    {cantidadSospechosa && (
                      <p className="mt-2.5 rounded-lg bg-amber-400/15 px-3 py-2 text-[12.5px] font-medium text-amber-800">
                        ¿Seguro que el cliente va a llevar {Number(escala.cantidad_min).toLocaleString('es-CO')} unidades?
                        Ese número es la CANTIDAD de frascos, no el precio. El precio va en la última casilla.
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="h-8" onClick={() => guardarEscala(f.id)}>
                        {escalaEditId != null ? 'Guardar cambios' : 'Agregar'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={cerrarEditorEscala}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="mt-2.5 h-8"
                    onClick={() => abrirEditorEscala(f.id)}>
                    <Plus className="size-3.5" /> Agregar rango de precio
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, id: null })}
        title={modal.id ? 'Editar tamaño' : 'Nuevo tamaño'}
        maxWidth={520}
        footer={
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setModal({ open: false, id: null })}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        }
      >
        <div className="space-y-4">
          <FieldRow>
            <Field label="Nombre">
              <Input value={form.nombre} maxLength={60} placeholder="30 ml"
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
            </Field>
            <Field label="Volumen total (ml)">
              <Input type="number" min="1" value={form.ml_total} placeholder="30"
                onChange={(e) => setForm((f) => ({ ...f, ml_total: e.target.value }))} />
            </Field>
          </FieldRow>
          <FieldRow>
            {/* La receta dice CUÁNTA esencia lleva, no CUÁL. Qué fragancia se
                descuenta lo decide el perfume que se vende; aquí solo viven las
                proporciones y los materiales generales (diluyente, sellador,
                feromonas, envase), que son iguales para todas. */}
            <Field label="Esencia (ml)">
              <Input type="number" min="0" step="0.1" value={form.esencia_ml}
                onChange={(e) => setForm((f) => ({ ...f, esencia_ml: e.target.value }))} />
              <p className="mt-1 text-[12px] text-muted-foreground">
                Cuánta esencia lleva. Cuál se usa lo dice cada perfume, no la receta.
              </p>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Sellador (ml)">
              <Input type="number" min="0" step="0.1" value={form.sellador_ml}
                onChange={(e) => setForm((f) => ({ ...f, sellador_ml: e.target.value }))} />
            </Field>
            <Field label="Feromonas (ml)">
              <Input type="number" min="0" step="0.1" value={form.feromonas_ml}
                onChange={(e) => setForm((f) => ({ ...f, feromonas_ml: e.target.value }))} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Envase">
              <SelectSimple value={form.envase_insumo_id}
                onChange={(e) => setForm((f) => ({ ...f, envase_insumo_id: e.target.value }))}>
                <option value="">— Sin envase —</option>
                {envases.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre} ({formatPrice(i.precio)})</option>
                ))}
              </SelectSimple>
            </Field>
          </FieldRow>

          <p className={`rounded-lg px-3 py-2 text-[13px] ${sobrepasa ? 'bg-destructive/10 font-medium text-destructive' : 'bg-secondary/60 text-muted-foreground'}`}>
            {sobrepasa
              ? 'La suma supera el volumen total: revisa las cantidades.'
              : <>Diluyente (se calcula solo): <strong className="text-foreground">{previoDiluyente} ml</strong></>}
          </p>

          {envases.length === 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              Aún no tienes envases registrados. Créalos en "Costos de producción".
            </p>
          )}
          {error && <p className="text-[12.5px] font-medium text-destructive">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
