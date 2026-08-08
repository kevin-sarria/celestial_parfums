import { useRef, useState } from 'react';
import { FileText, ImagePlus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import BuscadorSelect from '../../../components/BuscadorSelect';
import { BASE_URL } from '../../../infrastructure/api/client';
import { formatPrice } from '../helpers';
import { Field, FieldRow } from '../ui';
import type { GuardedFetch } from '../types';
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
  guardedFetch: GuardedFetch;
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
}

const esPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

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
  guardedFetch, insumos, lineas, onLineas, archivos, onArchivos, flete, onInsumoCreado,
}: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Mini-form para dar de alta un insumo sin salir de la factura
  const [nuevo, setNuevo] = useState<NuevoInsumo | null>(null);
  const [creando, setCreando] = useState(false);

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

  const agregar = (id: number | string) => {
    // Llega una esencia o un envase que nunca habías comprado: se crea aquí
    // mismo. Mandarlo a otra pestaña a mitad de una factura es perder el hilo.
    if (id === 'nuevo') { setNuevo({ nombre: '', tipo: 'materia_prima', unidad: 'ml' }); return; }
    const insumo = insumos.find((i) => i.id === Number(id));
    if (insumo) agregarInsumo(insumo);
  };

  /** Crea el insumo con precio 0: su costo lo fija ESTA compra al guardarse. */
  const crearInsumo = async () => {
    if (!nuevo) return;
    const nombre = nuevo.nombre.trim();
    if (!nombre) { toast.error('Ponle un nombre al insumo', { id: 'insumo-nuevo' }); return; }
    setCreando(true);
    try {
      const res = await guardedFetch(`${BASE_URL}/api/costeo/insumos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevo, nombre, alcance: 'unidad', precio: 0 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo crear el insumo', { id: 'insumo-nuevo' }); return; }
      const creado = json.data;
      onInsumoCreado(creado);
      agregarInsumo(creado);
      setNuevo(null);
      toast.success(`"${creado.nombre}" quedó creado y agregado a la compra`);
    } catch {
      toast.error('No se pudo conectar con el servidor', { id: 'insumo-nuevo' });
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
      const res = await guardedFetch(`${BASE_URL}/api/pagos/soportes`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudieron subir los soportes', { id: 'soportes' }); return; }
      onArchivos([...archivos, ...(json.data ?? [])]);
    } catch {
      toast.error('No se pudo conectar con el servidor', { id: 'soportes' });
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
      />

      {nuevo && (
        <div className="rounded-lg border border-primary/40 bg-card p-3">
          <p className="mb-2.5 text-[13px] font-medium text-foreground">Insumo nuevo</p>
          <FieldRow>
            <Field label="¿Cómo se llama?" className="min-w-52 flex-1">
              <Input autoFocus value={nuevo.nombre} maxLength={120}
                placeholder="Ej: Esencia Khamrah, Frasco luxury 30 ml"
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </Field>
            <Field label="¿Qué es?" className="w-44">
              <NativeSelect value={nuevo.tipo}
                onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as NuevoInsumo['tipo'] })}>
                <option value="materia_prima">Materia prima (esencia, alcohol…)</option>
                <option value="envase">Envase (frasco, tapa)</option>
                <option value="accesorio">Accesorio (bolsa, tarjeta)</option>
              </NativeSelect>
            </Field>
            <Field label="¿Cómo se mide?" className="w-40">
              <NativeSelect value={nuevo.unidad}
                onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value as NuevoInsumo['unidad'] })}>
                <option value="ml">Por mililitro o gramo</option>
                <option value="unidad">Por unidad</option>
              </NativeSelect>
            </Field>
          </FieldRow>
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
        <ul className="flex flex-col gap-2.5">
          {lineas.map((l, idx) => {
            const costo = costoConFlete(l);
            return (
              <li key={l.insumo_id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-end gap-2.5">
                  <p className="min-w-32 flex-1 text-[13.5px] font-medium text-foreground">{l.insumo_nombre}</p>

                  <Field label="Cantidad" className="w-24">
                    <Input type="number" min="0" step="0.001" className="h-9" value={l.cantidad}
                      onChange={(e) => actualizar(idx, { cantidad: e.target.value })} />
                  </Field>

                  <Field label="Unidad" className="w-24">
                    <NativeSelect className="h-9" value={l.unidad_compra}
                      onChange={(e) => actualizar(idx, { unidad_compra: e.target.value as LineaCompra['unidad_compra'] })}>
                      <option value="ml">ml</option>
                      <option value="g">gramos</option>
                      <option value="l">litros</option>
                      <option value="kg">kilos</option>
                      <option value="unidad">unidades</option>
                    </NativeSelect>
                  </Field>

                  <Field label="Lo que costó" className="w-32">
                    <Input type="number" min="0" className="h-9" value={l.subtotal}
                      onChange={(e) => actualizar(idx, { subtotal: e.target.value })} />
                  </Field>

                  <Button type="button" size="icon" variant="ghost"
                    className="size-9 text-muted-foreground hover:text-destructive"
                    onClick={() => onLineas(lineas.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {costo > 0 && (
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    Te queda a <strong className="text-primary">{formatPrice(costo)}</strong> por{' '}
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
          <li className="text-right text-[12.5px] text-muted-foreground">
            Suma del detalle: <strong className="text-foreground">{formatPrice(totalSinFlete)}</strong>
            {flete > 0 && <> · con envío: <strong className="text-foreground">{formatPrice(totalSinFlete + flete)}</strong></>}
          </li>
        </ul>
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
