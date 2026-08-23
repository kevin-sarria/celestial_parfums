import { useEffect, useState } from 'react';
import { Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { EncabezadoPagina, Section } from '../ui';
import type { EscalaPrecio, FormulaVolumen } from '../../../domain/entities/cotizacion.types';

const escalaVacia = { cantidad_min: '', cantidad_max: '', precio: '' };

/**
 * Cuánto cobras por unidad según cuántas lleve un mayorista, tamaño por tamaño.
 *
 * **Vivía dentro de "Tamaños y fórmulas" y se separó el 2026-08-23**, por
 * decisión del dueño. Aquella pantalla mezclaba dos cosas que se miran con
 * cabezas distintas: la RECETA (cuánta esencia y qué frasco lleva un tamaño),
 * que toda la aplicación usa para descontar inventario en CADA venta, y estos
 * rangos, que solo se leen al cotizarle a un mayorista. Juntas, se podía tocar
 * un precio de mayoreo creyendo que se editaba una receta.
 *
 * Los tamaños se siguen creando en *Tamaños y fórmulas*: aquí no se crea
 * ninguno, solo se les pone precio. Por eso, sin tamaños, esta pantalla manda
 * allí en vez de ofrecer un botón que no debería existir.
 */
export function PreciosMayoreoTab() {
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Qué tamaño tiene el editor abierto y, si se edita uno existente, su id
  // (null = rango nuevo).
  const [escalaDe, setEscalaDe] = useState<number | null>(null);
  const [escalaEditId, setEscalaEditId] = useState<number | null>(null);
  const [escala, setEscala] = useState(escalaVacia);

  // Siempre en finally: si una llamada falla (sin conexión, 429…) la vista
  // NO puede quedarse cargando para siempre; hay que mostrar el error.
  const load = async () => {
    setLoading(true);
    try {
      const res = await http.get<{ data?: FormulaVolumen[] }>(urls.costeo.formulas);
      if (!res.ok) { setError(res.error); return; }
      setFormulas(res.cuerpo?.data ?? []);
      setError('');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

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
      <EncabezadoPagina titulo="Precios al mayoreo" count={formulas.length} />

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Para cada tamaño, <strong>cuántas unidades lleva el cliente → cuánto le cobras por cada
          una</strong>. Al armar una cotización, el sistema sugiere el precio del rango que
          corresponda a lo que pida de ESE tamaño. No cambia nada de la tienda al detal.
        </span>
      </p>

      {error && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={() => load()}>Reintentar</Button>
        </p>
      )}

      {formulas.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          {error
            ? 'No se pudo cargar la lista.'
            : 'Aún no hay tamaños que cotizar. Créalos primero en "Tamaños y fórmulas" (ej: 30 ml).'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {formulas.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <p className="text-[15px] font-medium text-foreground">{f.nombre}</p>
                <p className="text-[12.5px] text-muted-foreground">frasco de {f.ml_total} ml</p>
              </div>

              <div className="mt-3">
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
                          aria-label="Desde cuántas unidades"
                          value={escala.cantidad_min}
                          onChange={(e) => setEscala((s) => ({ ...s, cantidad_min: e.target.value }))} />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">u</span>
                      </div>
                      <span>hasta</span>
                      <div className="relative">
                        <Input type="number" min="1" className="h-9 w-28 pr-8 text-center" placeholder="sin tope"
                          aria-label="Hasta cuántas unidades"
                          value={escala.cantidad_max}
                          onChange={(e) => setEscala((s) => ({ ...s, cantidad_max: e.target.value }))} />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">u</span>
                      </div>
                      <span>, le cobras</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
                        <Input type="number" min="0" className="h-9 w-32 pl-6 text-center" placeholder="19000"
                          aria-label="Precio por unidad"
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
    </div>
  );
}
