import { useRef, useState } from 'react';
import { FileText, ImagePlus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import BuscadorSelect from '../../../components/BuscadorSelect';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { Field, FieldRow } from '../ui';
import type { Insumo } from '../../../domain/entities/cotizacion.types';

/** Línea de la compra tal como viaja al backend. */
export interface LineaCompra {
  insumo_id: number;
  insumo_nombre: string;
  cantidad: string;
  unidad_compra: 'ml' | 'g' | 'l' | 'kg' | 'unidad';
  subtotal: string;
}

/**
 * Cuánto vale una unidad de compra en la unidad base del insumo.
 * ml y gramos van 1 a 1 (así factura el sector); los **litros multiplican por
 * 1000** — sin esto, "20 L" de alcohol se registraría como 20 ml.
 */
const FACTOR: Record<LineaCompra['unidad_compra'], number> = { ml: 1, g: 1, l: 1000, kg: 1000, unidad: 1 };

interface Props {
  insumos: Insumo[];
  lineas: LineaCompra[];
  onLineas: (l: LineaCompra[]) => void;
  archivos: string[];
  onArchivos: (a: string[]) => void;
  /** Flete de la compra, para mostrar el costo real ya prorrateado. */
  flete: number;
  /** Avisa arriba que hay un insumo nuevo, para que entre a la lista. */
  onInsumoCreado: (i: Insumo) => void;
}

/** Lo mínimo para dar de alta un insumo: el precio lo pone la compra. */
interface NuevoInsumo {
  nombre: string;
  tipo: 'materia_prima' | 'envase' | 'accesorio';
  unidad: 'ml' | 'unidad';
  /** Gama de la esencia. Con gama elegida, el insumo ES una esencia. */
  gama_id: number | null;
  /** Para quién es la fragancia. '' = todavía no se dice. */
  genero: '' | 'dama' | 'caballero' | 'unisex';
  /** Crear además su producto del catálogo, ya enlazado a esta esencia. */
  crear_perfume: boolean;
}

const GENERO_TEXTO: Record<string, string> = {
  dama: 'Dama', caballero: 'Caballero', unisex: 'Unisex',
};

interface Gama { id: number; nombre: string }

const esPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

/** "Eros Caballero – Esencia" → "Eros Caballero". */
const sinSufijoEsencia = (s: string) =>
  s.replace(/\s*[–—-]\s*esencias?\s*$/i, '').replace(/^\s*esencias?\s+(de\s+)?/i, '').trim();

/**
 * Cómo se llamará cada cosa. El dueño teclea el nombre de la FRAGANCIA una sola
 * vez y de ahí salen los dos nombres: el material conserva el sufijo
 * "– Esencia" con el que están guardadas las otras 213, y el producto del
 * catálogo lleva el nombre limpio, que es el que ve el cliente.
 */
const nombresDe = (escrito: string) => {
  const limpio = escrito.trim();
  const fragancia = sinSufijoEsencia(limpio);
  return {
    fragancia,
    // Si ya lo escribió con sufijo se respeta tal cual: no se le agrega dos veces
    insumo: fragancia && fragancia !== limpio ? limpio : (fragancia ? `${fragancia} – Esencia` : ''),
  };
};

/**
 * Detalle de una compra: qué insumos entraron, a qué precio y los soportes de
 * la distribuidora.
 *
 * Aquí se ve el dato que de verdad importa: el **costo con flete**. El
 * transporte se reparte proporcional entre las líneas, así que una compra con
 * envío caro sube el costo real del material — y ese es el número que después
 * usan las cotizaciones y los márgenes.
 */
export default function DetalleCompra({
  insumos, lineas, onLineas, archivos, onArchivos, flete, onInsumoCreado,
}: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Mini-form para dar de alta un insumo sin salir de la factura
  const [nuevo, setNuevo] = useState<NuevoInsumo | null>(null);
  const [creando, setCreando] = useState(false);
  const [gamas, setGamas] = useState<Gama[]>([]);

  const totalSinFlete = lineas.reduce((s, l) => s + (Number(l.subtotal) || 0), 0);
  /** Mismo prorrateo que hace el backend, para que veas el costo antes de guardar. */
  const costoConFlete = (l: LineaCompra) => {
    // Se divide entre la cantidad BASE: 20 L son 20.000 ml
    const base = (Number(l.cantidad) || 0) * FACTOR[l.unidad_compra];
    const sub = Number(l.subtotal) || 0;
    if (base <= 0) return 0;
    const parte = totalSinFlete > 0 ? (sub / totalSinFlete) * flete : 0;
    return (sub + parte) / base;
  };

  /** Mete el insumo como línea nueva (o lo ignora si ya está). */
  const agregarInsumo = (insumo: { id: number; nombre: string; unidad: string }) => {
    if (lineas.some((l) => l.insumo_id === insumo.id)) return;
    onLineas([...lineas, {
      insumo_id: insumo.id,
      insumo_nombre: insumo.nombre,
      cantidad: '',
      unidad_compra: insumo.unidad === 'ml' ? 'ml' : 'unidad',
      subtotal: '',
    }]);
  };

  /** Las gamas se piden al abrir el mini-form, no al montar: casi ninguna
   *  compra da de alta material nuevo y sería una petición desperdiciada. */
  const cargarGamas = async () => {
    if (gamas.length) return;
    // Si falla no se avisa: sin gamas el alta sigue funcionando, solo que el
    // material queda sin clasificar.
    const res = await http.get<{ data?: Gama[] }>(urls.costeo.gamas);
    if (res.ok) setGamas(res.cuerpo?.data ?? []);
  };

  const agregar = (id: number | string) => {
    // Llega una esencia o un envase que nunca habías comprado: se crea aquí
    // mismo. Mandarlo a otra pestaña a mitad de una factura es perder el hilo.
    if (id === 'nuevo') {
      setNuevo({
        nombre: '', tipo: 'materia_prima', unidad: 'ml',
        gama_id: null, genero: '', crear_perfume: true,
      });
      void cargarGamas();
      return;
    }
    const insumo = insumos.find((i) => i.id === Number(id));
    if (insumo) agregarInsumo(insumo);
  };

  /** Con gama elegida el material ES una esencia: solo entonces hay perfume. */
  const esEsencia = !!nuevo && nuevo.tipo === 'materia_prima' && nuevo.gama_id !== null;
  const nombres = nombresDe(nuevo?.nombre ?? '');
  const conPerfume = esEsencia && !!nuevo?.crear_perfume && !!nombres.fragancia;

  /** Crea el insumo con precio 0: su costo lo fija ESTA compra al guardarse. */
  const crearInsumo = async () => {
    if (!nuevo) return;
    if (!nombres.insumo) { toast.error('Ponle un nombre al insumo', { id: 'insumo-nuevo' }); return; }
    setCreando(true);
    try {
      const res = await http.post<{ message?: string; data: Insumo }>(urls.costeo.crearInsumo, {
        tipo: nuevo.tipo,
        unidad: nuevo.unidad,
        // El sufijo "– Esencia" solo se agrega cuando de verdad lo es
        nombre: esEsencia ? nombres.insumo : nuevo.nombre.trim(),
        gama_id: esEsencia ? nuevo.gama_id : null,
        genero: esEsencia && nuevo.genero ? nuevo.genero : null,
        crear_perfume: conPerfume,
        ...(conPerfume ? { perfume_nombre: nombres.fragancia } : {}),
        alcance: 'unidad',
        precio: 0,
      });
      if (!res.ok || !res.cuerpo) { toast.error(res.error || 'No se pudo crear el insumo', { id: 'insumo-nuevo' }); return; }
      const creado = res.cuerpo.data;
      onInsumoCreado(creado);
      agregarInsumo(creado);
      setNuevo(null);
      // El mensaje lo redacta el servidor: es el único que sabe si el perfume se
      // creó, se enlazó a uno que ya existía o se dejó como estaba.
      toast.success(res.cuerpo.message ?? `"${creado.nombre}" quedó creado y agregado a la compra`);
    } finally { setCreando(false); }
  };

  const actualizar = (idx: number, cambios: Partial<LineaCompra>) =>
    onLineas(lineas.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    // Copiar YA: el FileList del input se vacía al limpiarlo abajo
    const elegidos = Array.from(files).slice(0, 10 - archivos.length);
    if (fileRef.current) fileRef.current.value = '';
    setSubiendo(true);
    try {
      const fd = new FormData();
      elegidos.forEach((f) => fd.append('archivos', f));
      const res = await http.subir<{ data?: string[] }>(urls.pagos.soportes, fd);
      if (!res.ok) { toast.error(res.error, { id: 'soportes' }); return; }
      onArchivos([...archivos, ...(res.cuerpo?.data ?? [])]);
    } finally { setSubiendo(false); }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-secondary/40 p-3.5">
      <div>
        <p className="text-[13px] font-medium text-foreground">¿Qué compraste?</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          Al detallarlo, el material entra al inventario y el costo promedio de cada insumo se
          actualiza solo. Si lo dejas vacío, el pago se registra pero no mueve inventario.
        </p>
      </div>

      <BuscadorSelect
        // "Crear nuevo" va PRIMERO: al final de una lista larga hay que hacer
        // scroll para encontrarlo y no se ve que la opción existe.
        opciones={[
          { id: 'nuevo', nombre: '+ Crear insumo nuevo (esencia, envase…)' },
          ...insumos
            .filter((i) => !lineas.some((l) => l.insumo_id === i.id))
            .map((i) => ({ id: i.id as number | string, nombre: `${i.nombre} (${i.unidad})` })),
        ]}
        placeholder="Agregar insumo a la compra…"
        onSelect={agregar}
        vacio="Sin insumos que coincidan"
        // Sin esto la lista se queda abierta y tapa el formulario de alta que
        // aparece justo debajo: se elige "crear nuevo" y no se ve nada.
        cierranPanel={['nuevo']}
      />

      {nuevo && (
        <div className="rounded-lg border border-primary/40 bg-card p-3">
          <p className="mb-2.5 text-[13px] font-medium text-foreground">Insumo nuevo</p>
          <FieldRow>
            <Field label={esEsencia ? '¿Qué fragancia llegó?' : '¿Cómo se llama?'} className="min-w-52 flex-1">
              <Input autoFocus value={nuevo.nombre} maxLength={120}
                placeholder={esEsencia ? 'Ej: Khamrah, Eros Caballero' : 'Ej: Diluyente, Frasco luxury 30 ml'}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </Field>
            <Field label="¿Qué es?" className="w-44">
              <SelectSimple value={nuevo.tipo}
                onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as NuevoInsumo['tipo'] })}>
                <option value="materia_prima">Materia prima (esencia, alcohol…)</option>
                <option value="envase">Envase (frasco, tapa)</option>
                <option value="accesorio">Accesorio (bolsa, tarjeta)</option>
              </SelectSimple>
            </Field>
            <Field label="¿Cómo se mide?" className="w-40">
              <SelectSimple value={nuevo.unidad}
                onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value as NuevoInsumo['unidad'] })}>
                <option value="ml">Por mililitro o gramo</option>
                <option value="unidad">Por unidad</option>
              </SelectSimple>
            </Field>
            {/* La gama solo aplica a materia prima, y es lo que distingue una
                ESENCIA del diluyente o el sellador: con gama elegida el sistema
                ya sabe cuánto cuesta por ml esa calidad y puede cotizar al
                mayoreo sin saber todavía qué fragancias van. */}
            {nuevo.tipo === 'materia_prima' && (
              <Field label="¿De qué gama es?" className="w-52">
                <BuscadorSelect
                  opciones={[
                    { id: 0, nombre: 'No es una esencia (diluyente, sellador…)' },
                    ...gamas.map((g) => ({ id: g.id as number | string, nombre: g.nombre })),
                  ]}
                  value={nuevo.gama_id ?? 0}
                  placeholder="Elegir gama…"
                  onSelect={(id) => setNuevo({ ...nuevo, gama_id: Number(id) || null })}
                  vacio="Todavía no has creado gamas"
                />
              </Field>
            )}
            {/* Solo 3 opciones fijas: aquí el buscador estorbaría más de lo que
                ayuda (la regla del proyecto lo reserva para listas que crecen). */}
            {esEsencia && (
              <Field label="¿Para quién es?" className="w-40">
                <SelectSimple value={nuevo.genero}
                  onChange={(e) => setNuevo({ ...nuevo, genero: e.target.value as NuevoInsumo['genero'] })}>
                  <option value="">Todavía no sé</option>
                  <option value="dama">Dama</option>
                  <option value="caballero">Caballero</option>
                  <option value="unisex">Unisex</option>
                </SelectSimple>
              </Field>
            )}
          </FieldRow>

          {/* Con gama elegida es una esencia, y toda esencia tiene su perfume.
              Crearlo aquí es lo que deja la cadena completa desde que llega el
              material hasta que se descuenta al vender. */}
          {esEsencia && (
            <label className="mt-2.5 flex items-start gap-2 rounded-lg border border-border bg-secondary/50 p-2.5">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={nuevo.crear_perfume}
                onChange={(e) => setNuevo({ ...nuevo, crear_perfume: e.target.checked })} />
              <span className="text-[12.5px] leading-snug">
                <span className="font-medium text-foreground">
                  Crear también el perfume en el catálogo
                </span>
                {conPerfume ? (
                  <span className="mt-1 block text-muted-foreground">
                    Se guardarán dos cosas:{' '}
                    <strong className="font-medium text-foreground">{nombres.insumo}</strong>{' '}
                    como material de esta compra, y{' '}
                    <strong className="font-medium text-foreground">{nombres.fragancia}</strong>{' '}
                    {nuevo.genero && ` (${GENERO_TEXTO[nuevo.genero]})`} como producto —{' '}
                    <strong className="font-medium text-primary">fuera de la tienda</strong>, con su
                    esencia ya enlazada, para que le pongas precio y foto cuando quieras. Si ese
                    perfume ya existe, se enlaza en vez de duplicarlo.
                  </span>
                ) : (
                  <span className="mt-1 block text-muted-foreground">
                    Escribe el nombre de la fragancia y te digo cómo va a quedar.
                  </span>
                )}
              </span>
            </label>
          )}

          {/* No se pregunta el precio a propósito: sale del costo promedio que
              calcula esta misma compra. Teclearlo a mano sería inventárselo. */}
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            No hace falta el precio: lo fija esta compra cuando la guardes.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" onClick={crearInsumo} disabled={creando}>
              {creando ? 'Creando…' : 'Crear y agregar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNuevo(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {lineas.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <ul className="divide-y divide-border">
            {lineas.map((l, idx) => {
              const costo = costoConFlete(l);
              return (
                /* `@container`: lo que manda es el ancho de ESTA tarjeta, no el
                   de la ventana. Las casillas se ponen en fila solo si de verdad
                   caben; si no, cada una ocupa el ancho completo. Medir la
                   ventana fue el error de la versión anterior: el modal mide
                   540 px aunque la pantalla tenga 1400. */
                <li key={l.insumo_id} className="@container px-3 py-2.5">
                  {/* El nombre ocupa su propio renglón: las esencias se llaman
                      "212 Heroes Dama – Esencia" y en una columna estrecha se
                      partían en cuatro líneas. */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium leading-snug text-foreground">{l.insumo_nombre}</p>
                    <Button type="button" size="icon" variant="ghost"
                      aria-label={`Quitar ${l.insumo_nombre}`}
                      className="-mr-1 size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onLineas(lineas.filter((_, i) => i !== idx))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* Cada casilla lleva SU etiqueta encima, siempre visible.
                      Antes iban una sola vez en una fila de encabezado: al
                      angostarse el modal esa fila desaparecía y quedaban tres
                      casillas mudas, sin forma de saber qué iba en cada una. */}
                  <div className="mt-1.5 grid grid-cols-1 gap-2 @sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Cantidad</span>
                      <Input type="number" min="0" step="0.001" placeholder="0"
                        className="h-8 text-right text-[12.5px] tabular-nums" value={l.cantidad}
                        onChange={(e) => actualizar(idx, { cantidad: e.target.value })} />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Unidad</span>
                      <SelectSimple className="h-8 text-[12.5px]" value={l.unidad_compra}
                        onChange={(e) => actualizar(idx, { unidad_compra: e.target.value as LineaCompra['unidad_compra'] })}>
                        <option value="ml">ml</option>
                        <option value="g">gramos</option>
                        <option value="l">litros</option>
                        <option value="kg">kilos</option>
                        <option value="unidad">unidades</option>
                      </SelectSimple>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Lo que costó</span>
                      {/* Sin flechitas: en un precio no sirven de nada y en el
                          celular tapaban un dígito. */}
                      <Input type="number" min="0" placeholder="$ 0"
                        className="h-8 text-right text-[12.5px] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={l.subtotal}
                        onChange={(e) => actualizar(idx, { subtotal: e.target.value })} />
                    </label>
                  </div>

                  {/* Segunda línea gris: el costo real por unidad, que es el dato
                      que de verdad importa y no merece una columna propia. */}
                  {costo > 0 && (
                    <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                      Te queda a <strong className="font-semibold text-primary">{formatPrice(costo)}</strong> por{' '}
                      {l.unidad_compra === 'unidad' ? 'unidad' : 'ml'}
                      {flete > 0 && ' (ya con la parte del envío)'}
                      {/* Los litros se convierten: es donde más fácil se mete un error de 1000× */}
                      {l.unidad_compra === 'l' && (
                        <span className="text-primary/80">
                          {' '}— son {(Number(l.cantidad) * 1000).toLocaleString('es-CO')} ml
                        </span>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="border-t border-border bg-secondary/40 px-3 py-1.5 text-right text-[12.5px] text-muted-foreground">
            Suma del detalle: <strong className="text-foreground">{formatPrice(totalSinFlete)}</strong>
            {flete > 0 && <> · con envío: <strong className="text-foreground">{formatPrice(totalSinFlete + flete)}</strong></>}
          </p>
        </div>
      )}

      {/* Soportes: la factura o remisión de la distribuidora */}
      <div>
        <p className="text-[13px] font-medium text-foreground">Soportes de la compra</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {archivos.map((u) => (
            <div key={u} className="relative">
              <a href={u} target="_blank" rel="noreferrer"
                className="flex size-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
                {esPdf(u)
                  ? <span className="flex flex-col items-center gap-0.5 text-muted-foreground">
                      <FileText className="size-5" /><span className="text-[9px]">PDF</span>
                    </span>
                  : <img src={u} alt="" className="size-16 object-cover" />}
              </a>
              <button type="button" aria-label="Quitar"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-background"
                onClick={() => onArchivos(archivos.filter((x) => x !== u))}>
                <X className="size-3" />
              </button>
            </div>
          ))}
          {archivos.length < 10 && (
            <button type="button" disabled={subiendo} onClick={() => fileRef.current?.click()}
              className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60">
              <ImagePlus className="size-5" />
              <span className="text-[10px]">{subiendo ? '…' : 'Subir'}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
            onChange={(e) => subir(e.target.files)} />
        </div>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Fotos o PDF de la factura. Las imágenes se comprimen solas; máximo 8 MB por archivo.
        </p>
      </div>
    </div>
  );
}
