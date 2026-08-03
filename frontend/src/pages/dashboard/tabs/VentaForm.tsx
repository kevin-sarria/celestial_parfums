import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, TriangleAlert, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import { detectarCombos } from '../../../application/hooks/useComboDetector';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import { ArmadorPedido } from '../pedido/ArmadorPedido';
import { ResumenPedido } from '../pedido/ResumenPedido';
import {
  descuentoDeCupon, itemsDeLineas, presentacionResumen, subtotalDeLineas, unidadesDeLineas,
  type LineaPedido,
} from '../pedido/lineasPedido';
import {
  API, API_USUARIOS, API_VENTAS, formatPrice, parseClienteSeleccion, personaLabel, validarCodigoDescuento,
} from '../helpers';
import { BloqueCampos, Field, FieldRow, FormError } from '../ui';
import type { CodigoValidado, ClienteSeleccion, GuardedFetch, Usuario, Venta } from '../types';

interface VentaFormProps {
  open: boolean;
  /** null = registrar una venta nueva. */
  venta: Venta | null;
  usuarios: Usuario[];
  catalogo: Perfume[];
  combos: Combo[];
  guardedFetch: GuardedFetch;
  onClose: () => void;
  /** @param recargarCatalogos true si se creó una persona o un producto. */
  onSaved: (recargarCatalogos: boolean) => void;
}

interface EstadoForm {
  dia: string;
  persona: string;
  user_id: ClienteSeleccion;
  lineas: LineaPedido[];
  valor_venta: string;
  datos_adicionales: string;
  pagada: boolean;
  codigo_descuento: string;
  nuevo_nombre: string; nuevo_apellido: string; nuevo_correo: string;
  nuevo_telefono: string; nuevo_direccion: string;
}

const vacio = (): EstadoForm => ({
  dia: new Date().toISOString().slice(0, 10),
  persona: '', user_id: '', lineas: [], valor_venta: '',
  datos_adicionales: '', pagada: true, codigo_descuento: '',
  nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '',
  nuevo_telefono: '', nuevo_direccion: '',
});

/**
 * Registrar o editar una venta.
 *
 * Tres bloques: a quién se le vendió, qué se llevó y cuánto se cobró. El valor
 * se sigue tecleando a mano (es la plata que entró de verdad); el sistema hace
 * la cuenta y la ofrece con el botón "usar".
 */
export function VentaForm({
  open, venta, usuarios, catalogo, combos, guardedFetch, onClose, onSaved,
}: VentaFormProps) {
  const [form, setForm] = useState<EstadoForm>(vacio());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  /** Referencia libre de una venta importada que no coincidió con el catálogo. */
  const [referenciaInvalida, setReferenciaInvalida] = useState('');
  const [creoAlgo, setCreoAlgo] = useState(false);

  const porId = useMemo(() => new Map(catalogo.map(p => [p.id, p])), [catalogo]);

  // ── Reconstruir el formulario al abrir ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(''); setCodigoCheck(null); setCuponAplicado(false); setCreoAlgo(false);
    if (!venta) {
      setForm(vacio()); setReferenciaInvalida('');
      return;
    }
    const lineas: LineaPedido[] = venta.perfumes.map((p, i) => {
      const cat = porId.get(p.id);
      // La talla guardada es el número; la etiqueta se busca por ese número
      const talla = cat?.precios.find(x => x.ml === p.ml);
      return {
        key: `${p.id}-${p.ml ?? 'sin'}-${i}`,
        perfume_id: p.id,
        nombre: p.nombre,
        presentacion: talla?.presentacion ?? null,
        ml: p.ml ?? null,
        cantidad: p.cantidad ?? 1,
        sin_descuento: false,
      };
    });
    setForm({
      ...vacio(),
      dia: venta.dia.slice(0, 10),
      persona: venta.persona,
      user_id: venta.user_id ?? '',
      lineas,
      valor_venta: String(venta.valor_venta),
      datos_adicionales: venta.datos_adicionales ?? '',
      pagada: venta.pagada,
      codigo_descuento: venta.codigo?.codigo ?? '',
    });
    setReferenciaInvalida(venta.perfumes.length === 0 ? venta.referencia_perfume : '');
  }, [open, venta, porId]);

  // ── Cupón ─────────────────────────────────────────────────────────────────
  const [codigoCheck, setCodigoCheck] = useState<CodigoValidado | null>(null);
  const [validando, setValidando] = useState(false);
  const [cuponAplicado, setCuponAplicado] = useState(false);

  /**
   * Un cupón ya canjeado queda amarrado a esta venta: el campo se bloquea. Para
   * cambiarlo hay que eliminar la venta y volver a registrarla. El servidor
   * rechaza el cambio igualmente; esto solo evita que se intente.
   */
  const codigoBloqueado = venta?.codigo?.estado === 'canjeado' ? venta.codigo.codigo : null;

  const validarCodigo = async () => {
    const codigo = form.codigo_descuento.trim();
    if (!codigo) return;
    setValidando(true); setCodigoCheck(null);
    setCodigoCheck(await validarCodigoDescuento(guardedFetch, codigo));
    setValidando(false);
  };

  // ── Números del pedido ────────────────────────────────────────────────────
  const subtotal = subtotalDeLineas(form.lineas, porId);
  const unidades = unidadesDeLineas(form.lineas);

  /**
   * Al contado el precio de combo SIEMPRE aplica: no es una promoción, es la
   * política de precios del negocio. Por eso aquí no hay interruptor.
   */
  const ahorroCombo = useMemo(() => {
    if (form.lineas.length === 0 || combos.length === 0) return 0;
    return detectarCombos(itemsDeLineas(form.lineas, porId), combos)?.ahorroTotal ?? 0;
  }, [form.lineas, combos, porId]);

  const cupon = codigoCheck?.valido ? codigoCheck.cupon : undefined;
  const baseCupon = Math.max(0, subtotal - ahorroCombo);
  const noAlcanzaMinimo = !!cupon && cupon.min_monto > 0 && baseCupon < cupon.min_monto;
  const descuentoCupon = cupon && !noAlcanzaMinimo
    ? descuentoDeCupon(baseCupon, cupon.descuento_pct, cupon.max_descuento)
    : 0;
  const topeRecorto = !!cupon && cupon.max_descuento > 0 && descuentoCupon > 0
    && Math.round((baseCupon * cupon.descuento_pct) / 100) > cupon.max_descuento;

  const sugerido = Math.max(0, subtotal - ahorroCombo - descuentoCupon);

  // ── Alta rápida de producto ───────────────────────────────────────────────
  const [nuevoProd, setNuevoProd] = useState<{ nombre: string; precio: string } | null>(null);
  const [creandoProd, setCreandoProd] = useState(false);

  const crearProducto = async () => {
    const nombre = nuevoProd?.nombre.trim();
    const precio = Number(nuevoProd?.precio);
    if (!nombre || !(precio > 0)) { setError('Ponle nombre y precio al producto nuevo'); return; }
    setCreandoProd(true);
    try {
      const res = await guardedFetch(`${API}/create`, {
        method: 'POST',
        body: JSON.stringify({ nombre, precio, tipos_aroma: [], ocasiones: [], presentaciones: [] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error ?? 'No se pudo crear el producto'); return; }
      setForm(f => ({
        ...f,
        lineas: [...f.lineas, {
          key: `${json.data.id}-sin-${Date.now()}`,
          perfume_id: json.data.id, nombre: json.data.nombre,
          presentacion: null, ml: null, cantidad: 1, sin_descuento: false,
        }],
      }));
      setNuevoProd(null); setError(''); setCreoAlgo(true);
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setCreandoProd(false); }
  };

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setGuardando(true); setError('');

    if (form.lineas.length === 0) {
      setError('Agrega al menos un producto'); setGuardando(false); return;
    }

    let userId: number | null = typeof form.user_id === 'number' ? form.user_id : null;
    let creoPersona = false;

    if (form.user_id === 'nuevo') {
      if (!form.nuevo_nombre.trim() || !form.nuevo_apellido.trim()) {
        setError('Nombre y apellido de la persona son obligatorios'); setGuardando(false); return;
      }
      try {
        const res = await guardedFetch(API_USUARIOS, {
          method: 'POST',
          body: JSON.stringify({
            nombre: form.nuevo_nombre.trim(), apellido: form.nuevo_apellido.trim(),
            email: form.nuevo_correo.trim() || undefined,
            telefono: form.nuevo_telefono.trim() || undefined,
            direccion: form.nuevo_direccion.trim() || undefined,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) { setError(json?.error ?? 'Error al crear la persona'); setGuardando(false); return; }
        userId = json.data.id; creoPersona = true;
      } catch { setError('No se pudo crear la persona'); setGuardando(false); return; }
    }

    const body = {
      dia: form.dia,
      persona: form.persona.trim(),
      user_id: userId,
      // Se deriva de las líneas: antes era una casilla aparte que tocaba cuadrar
      cantidad_perfumes: unidades,
      presentacion: presentacionResumen(form.lineas),
      lineas: form.lineas.map(l => ({ perfume_id: l.perfume_id, ml: l.ml, cantidad: l.cantidad })),
      valor_venta: Number(form.valor_venta),
      datos_adicionales: form.datos_adicionales.trim() || null,
      pagada: form.pagada,
      codigo_descuento: form.codigo_descuento.trim().toUpperCase() || null,
    };

    try {
      const url = venta ? `${API_VENTAS}/${venta.id}` : API_VENTAS;
      const res = await guardedFetch(url, { method: venta ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error ?? 'Error al guardar'); return; }
      onSaved(creoPersona || creoAlgo);
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setGuardando(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={venta ? 'Editar venta' : 'Registrar venta'}
      onSubmit={handleSubmit}
      submitLabel={guardando ? 'Guardando...' : venta ? 'Guardar cambios' : 'Registrar'}
      loading={guardando}
      maxWidth={620}
    >
      <BloqueCampos titulo="¿Cuándo y a quién?">
        <FieldRow>
          <Field label="Día *">
            <Input type="date" required value={form.dia}
              onChange={e => setForm(f => ({ ...f, dia: e.target.value }))} />
          </Field>
          <Field label="Persona *">
            <Input required value={form.persona} maxLength={100}
              onChange={e => setForm(f => ({ ...f, persona: e.target.value }))} />
          </Field>
        </FieldRow>

        <Field label="Cliente enlazado (opcional)">
          <BuscadorSelect
            value={String(form.user_id)}
            placeholder="— Sin cliente —"
            opciones={[
              { id: '', nombre: '— Sin cliente —' },
              { id: 'nuevo', nombre: '+ Registrar persona nueva' },
              ...usuarios.map(u => ({ id: u.id, nombre: personaLabel(u) })),
            ]}
            onSelect={id => setForm(f => ({ ...f, user_id: parseClienteSeleccion(String(id)) }))}
          />
        </Field>

        {form.user_id === 'nuevo' && (
          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3.5">
            <FieldRow>
              <Field label="Nombre *">
                <Input value={form.nuevo_nombre} maxLength={60}
                  onChange={e => setForm(f => ({ ...f, nuevo_nombre: e.target.value }))} />
              </Field>
              <Field label="Apellido *">
                <Input value={form.nuevo_apellido} maxLength={60}
                  onChange={e => setForm(f => ({ ...f, nuevo_apellido: e.target.value }))} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Teléfono">
                <Input value={form.nuevo_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nuevo_telefono: e.target.value }))} />
              </Field>
              <Field label="Correo (si se registra con él, hereda su historial)">
                <Input type="email" value={form.nuevo_correo} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nuevo_correo: e.target.value }))} />
              </Field>
            </FieldRow>
            <Field label="Dirección">
              <Input value={form.nuevo_direccion} maxLength={150}
                onChange={e => setForm(f => ({ ...f, nuevo_direccion: e.target.value }))} />
            </Field>
          </div>
        )}
      </BloqueCampos>

      <BloqueCampos titulo="¿Qué se llevó?">
        {referenciaInvalida && form.lineas.length === 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            "{referenciaInvalida}" no coincide con ningún producto del catálogo. Elige uno o varios.
          </p>
        )}

        <ArmadorPedido
          lineas={form.lineas}
          onChange={lineas => setForm(f => ({ ...f, lineas }))}
          catalogo={catalogo}
          porId={porId}
          onCrearProducto={() => setNuevoProd({ nombre: '', precio: '' })}
        />

        {nuevoProd && (
          <div className="space-y-2 rounded-lg border border-primary/25 bg-brand-soft/40 p-3">
            <p className="text-[12.5px] text-primary">
              Producto nuevo. Con el nombre y el precio basta para vender hoy; la ficha
              completa (esencia, tallas, fotos) la llenas después en Catálogo.
            </p>
            <FieldRow>
              <Field label="Nombre *">
                <Input value={nuevoProd.nombre} maxLength={150} autoFocus
                  placeholder="Ej: Thank U Next 1.1"
                  onChange={e => setNuevoProd({ ...nuevoProd, nombre: e.target.value })} />
              </Field>
              <Field label="Precio *">
                <Input type="number" min="0" value={nuevoProd.precio}
                  onChange={e => setNuevoProd({ ...nuevoProd, precio: e.target.value })} />
              </Field>
            </FieldRow>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={creandoProd} onClick={crearProducto}>
                {creandoProd ? 'Creando…' : 'Crear y agregar'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setNuevoProd(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </BloqueCampos>

      <BloqueCampos titulo="¿Cuánto y cómo?">
        {form.lineas.length > 0 && (
          <ResumenPedido
            subtotal={subtotal}
            unidades={unidades}
            ahorroCombo={ahorroCombo}
            cupon={descuentoCupon > 0 && cupon
              ? { codigo: form.codigo_descuento.trim().toUpperCase(), pct: cupon.descuento_pct, descuento: descuentoCupon }
              : null}
            etiquetaTotal="Sugerido"
            onUsar={() => { setForm(f => ({ ...f, valor_venta: String(sugerido) })); setCuponAplicado(true); }}
          />
        )}

        <FieldRow>
          <Field label="Valor de la venta (COP) *">
            <Input type="number" min="0" required value={form.valor_venta}
              onChange={e => { setCuponAplicado(false); setForm(f => ({ ...f, valor_venta: e.target.value })); }} />
          </Field>
          <Field label="Estado de pago">
            <NativeSelect value={form.pagada ? 'pagada' : 'pendiente'}
              onChange={e => setForm(f => ({ ...f, pagada: e.target.value === 'pagada' }))}>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente de pago</option>
            </NativeSelect>
          </Field>
        </FieldRow>

        {cuponAplicado && (
          <p className="text-[12.5px] font-medium text-emerald-700">
            Listo, el valor ya es el final.
          </p>
        )}

        <Field label="Código de descuento (si el pedido de WhatsApp traía uno)">
          {codigoBloqueado ? (
            <>
              <div className="relative">
                <Input value={codigoBloqueado} disabled className="pr-9 uppercase" />
                <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <p className="mt-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-[12.5px] text-muted-foreground">
                Este cupón <strong>ya se canjeó</strong> y queda amarrado a esta venta. Para
                cambiarlo hay que eliminar la venta y volver a registrarla — así nadie lo
                revive por accidente.
              </p>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Input value={form.codigo_descuento} maxLength={20} placeholder="Ej: CP-7XK2M9"
                  className="uppercase"
                  onChange={e => { setForm(f => ({ ...f, codigo_descuento: e.target.value })); setCodigoCheck(null); }} />
                <Button type="button" variant="outline" className="shrink-0"
                  disabled={validando || !form.codigo_descuento.trim()} onClick={validarCodigo}>
                  {validando ? 'Validando…' : 'Validar'}
                </Button>
              </div>

              {codigoCheck && (
                <p className={`mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium ${codigoCheck.valido || codigoCheck.venta ? 'text-emerald-700' : 'text-destructive'}`}>
                  {codigoCheck.valido || codigoCheck.venta
                    ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    : <XCircle className="mt-0.5 size-3.5 shrink-0" />}
                  <span>
                    {codigoCheck.motivo}
                    {codigoCheck.cupon && ` — "${codigoCheck.cupon.titulo}" (-${codigoCheck.cupon.descuento_pct}%) de ${codigoCheck.persona}`}
                  </span>
                </p>
              )}

              {cupon && noAlcanzaMinimo && (
                <p className="mt-1.5 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
                  Este cupón pide una compra mínima de {formatPrice(cupon.min_monto)} y el pedido
                  va en {formatPrice(baseCupon)}. Revisa antes de aplicarlo.
                </p>
              )}

              {topeRecorto && (
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  El tope de la campaña es {formatPrice(cupon!.max_descuento)}, así que el
                  descuento se quedó ahí.
                </p>
              )}
            </>
          )}

          <p className="mt-1 text-[12px] text-muted-foreground">
            El valor se escribe <strong>ya con el descuento restado</strong> (es la plata que
            entró de verdad). El código se canjea cuando la venta queda marcada como pagada.
          </p>
        </Field>

        <Field label="Notas">
          <Textarea rows={2} value={form.datos_adicionales} maxLength={300}
            onChange={e => setForm(f => ({ ...f, datos_adicionales: e.target.value }))} />
        </Field>
      </BloqueCampos>

      <FormError>{error}</FormError>
    </Modal>
  );
}
