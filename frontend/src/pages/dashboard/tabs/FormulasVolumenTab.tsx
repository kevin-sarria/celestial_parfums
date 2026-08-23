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
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

const formVacio = {
  nombre: '', ml_total: '', esencia_ml: '', sellador_ml: '0', feromonas_ml: '0',
  envase_insumo_id: '' as string,
};

/**
 * Tamaños fabricables (30/50/100 ml…) con su receta. El diluyente nunca se
 * teclea: es el resto del volumen.
 *
 * **Los rangos de precio mayorista salieron de aquí el 2026-08-23** y viven en
 * `PreciosMayoreoTab`. Esta pantalla es operación diaria —de ella salen los
 * materiales que descuenta cada venta—; aquello es otro negocio y se mira con
 * otra cabeza. El porqué está en esa pantalla.
 */
export function FormulasVolumenTab() {
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [form, setForm] = useState(formVacio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
  useEffect(() => { load(); }, []);

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

  if (loading) return <Section><PerfumeSpinner /></Section>;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Tamaños y fórmulas" count={formulas.length}>
        <Button size="sm" onClick={abrirNuevo}><Plus className="size-4" /> Nuevo tamaño</Button>
      </EncabezadoPagina>

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Define cada tamaño que fabricas y su receta: de aquí salen los materiales que se
          descuentan del inventario en <strong>cada venta y cada lote</strong>. El{' '}
          <strong>diluyente se calcula solo</strong> (es lo que sobra del volumen). Lo que le
          cobras a un mayorista según cuántas unidades lleve ya no se pone aquí: vive en{' '}
          <strong>Mayoreo B2B → Precios al mayoreo</strong>.
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
