import { useEffect, useState } from 'react';
import { ArrowLeft, Download, MessageCircle, Save, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import LineasCotizacion from './LineasCotizacion';
import { MargenPorGama, type PromedioGama } from './MargenPorGama';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { Field, FieldRow, Section } from '../ui';
import { rentabilidadTotal } from '../../../application/costeoCotizacion';
import { descargarCotizacionPdf, mensajeWhatsappCotizacion } from '../../../utils/cotizacionPdf';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type {
  AccesorioSeleccionado, CondicionesComerciales, Cotizacion, CotizacionConfig, CotizacionItem, CotizacionTipo,
  FormulaVolumen, Insumo, ListaPreciosVolumen,
} from '../../../domain/entities/cotizacion.types';

interface Props {
  /** Cotización a editar; null = nueva. */
  cotizacion: Cotizacion | null;
  onVolver: () => void;
  onGuardada: () => void;
}

const CAMPOS_CONDICIONES: { k: keyof CondicionesComerciales; label: string }[] = [
  { k: 'pedido_minimo', label: 'Pedido mínimo' },
  { k: 'tiempo_preparacion', label: 'Tiempo de preparación' },
  { k: 'tiempo_despacho', label: 'Tiempo de despacho' },
  { k: 'forma_pago', label: 'Forma de pago' },
  { k: 'condiciones_pago', label: 'Condiciones de pago' },
  { k: 'costos_envio', label: 'Costos de envío' },
  { k: 'garantias', label: 'Garantías' },
  { k: 'politica_cambios', label: 'Política de cambios' },
];

/**
 * Formulario de cotización mayorista: datos del cliente, líneas de producto con
 * costeo en vivo, condiciones y acciones (guardar, PDF, WhatsApp). El panel de
 * rentabilidad es interno y no viaja al documento del cliente.
 */
export default function CotizacionForm({ cotizacion, onVolver, onGuardada }: Props) {
  const [cargando, setCargando] = useState(true);
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [config, setConfig] = useState<CotizacionConfig | null>(null);

  const [cliente, setCliente] = useState({
    cliente_nombre: cotizacion?.cliente_nombre ?? '',
    cliente_empresa: cotizacion?.cliente_empresa ?? '',
    cliente_telefono: cotizacion?.cliente_telefono ?? '',
    cliente_email: cotizacion?.cliente_email ?? '',
    cliente_nit: cotizacion?.cliente_nit ?? '',
  });
  const [tipo, setTipo] = useState<CotizacionTipo>(cotizacion?.tipo ?? 'detallada');
  const [lineas, setLineas] = useState<CotizacionItem[]>(cotizacion?.items ?? []);
  // Tamaños incluidos en una cotización GENERAL (solo lista de precios)
  const [volumenesSel, setVolumenesSel] = useState<number[]>([]);
  // Costo por ml promedio de cada gama de esencia: con eso se costea la lista
  // de precios, que no dice qué fragancias lleva.
  const [gamas, setGamas] = useState<PromedioGama[]>([]);
  // Insumos que van UNA vez por pedido (caja de envío…), no por perfume
  const [extras, setExtras] = useState<AccesorioSeleccionado[]>(cotizacion?.extras_pedido ?? []);
  const [descuento, setDescuento] = useState(String(cotizacion?.descuento_pct ?? 0));
  const [vigencia, setVigencia] = useState(String(cotizacion?.vigencia_dias ?? 15));
  const [condiciones, setCondiciones] = useState<CondicionesComerciales | null>(
    cotizacion?.condiciones_comerciales ?? null,
  );
  const [observaciones, setObservaciones] = useState(cotizacion?.observaciones ?? '');
  const [costoAbierto, setCostoAbierto] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardada, setGuardada] = useState<Cotizacion | null>(cotizacion);

  useEffect(() => {
    (async () => {
      const [rp, rf, ri, rc, rg] = await Promise.all([
        http.get<{ data?: Perfume[] | { data?: Perfume[] } }>(urls.perfumes.todos),
        http.get<{ data?: FormulaVolumen[] }>(urls.costeo.formulas),
        http.get<{ data?: Insumo[] }>(urls.costeo.insumos),
        http.get<{ data?: CotizacionConfig }>(urls.costeo.config),
        http.get<{ data?: PromedioGama[] }>(urls.costeo.promediosPorGama),
      ]);
      // Si falla, el resto del formulario debe seguir sirviendo: sin gamas solo
      // se pierde el panel de costo, no la posibilidad de cotizar.
      if (rg.ok) setGamas(rg.cuerpo?.data ?? []);
      // /api/parfums sin paginar responde { data: { data: [...] } }; se
      // desenvuelve tolerando ambas formas por si el endpoint cambia.
      const jp = rp.cuerpo?.data;
      setPerfumes(Array.isArray(jp) ? jp : (jp?.data ?? []));
      const fs: FormulaVolumen[] = rf.cuerpo?.data ?? [];
      setFormulas(fs);
      setInsumos(ri.cuerpo?.data ?? []);
      const cfg = rc.cuerpo?.data;
      setConfig(cfg ?? null);
      // Al editar una general, se vuelven a marcar los tamaños que ya traía
      if (cotizacion?.tipo === 'general' && cotizacion.lista_precios) {
        const nombres = cotizacion.lista_precios.map((l) => l.volumen_nombre);
        setVolumenesSel(fs.filter((f) => nombres.includes(f.nombre)).map((f) => f.id));
      }
      // Cotización nueva: arranca con los valores por defecto del negocio
      if (!cotizacion && cfg) {
        setCondiciones(cfg.condiciones_comerciales);
        setVigencia(String(cfg.vigencia_dias_default));
      }
      setCargando(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const descuentoPct = Number(descuento) || 0;
  const rent = rentabilidadTotal(lineas, descuentoPct);
  // Sin precio la "utilidad" sería toda negativa (costo contra cero) y no
  // significa nada: se avisa qué falta en vez de mostrar un número alarmante.
  const sinPrecio = lineas.filter((l) => l.precio_unitario <= 0).length;
  const faltanPrecios = sinPrecio > 0;
  /**
   * ¿Todavía no hay nada que cotizar? Depende del tipo: la detallada necesita
   * productos y la general, tamaños. (Antes se miraba solo `lineas`, así que en
   * una lista de precios los botones quedaban deshabilitados para siempre.)
   */
  const sinContenido = tipo === 'general' ? volumenesSel.length === 0 : lineas.length === 0;
  // Accesorios de alcance "pedido": se cobran una vez, no por perfume
  const extrasDisponibles = insumos.filter((i) => i.tipo === 'accesorio' && i.alcance === 'pedido');
  const costoExtras = extras.reduce((s, e) => s + Number(e.precio), 0);
  const toggleExtra = (insumo: Insumo) => {
    setExtras((prev) => prev.some((e) => e.insumo_id === insumo.id)
      ? prev.filter((e) => e.insumo_id !== insumo.id)
      : [...prev, { insumo_id: insumo.id, nombre: insumo.nombre, precio: insumo.precio }]);
  };
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const total = Math.round(subtotal * (1 - descuentoPct / 100));

  /** Lista de precios congelada a partir de los tamaños marcados (solo general). */
  const listaPrecios = (): ListaPreciosVolumen[] =>
    formulas
      .filter((f) => volumenesSel.includes(f.id))
      .map((f) => ({
        volumen_nombre: f.nombre,
        escalas: f.escalas.map((e) => ({ desde: e.cantidad_min, hasta: e.cantidad_max, precio: e.precio })),
      }));

  const construirPayload = () => ({
    tipo,
    lista_precios: tipo === 'general' ? listaPrecios() : null,
    extras_pedido: tipo === 'general' ? [] : extras,
    ...cliente,
    cliente_empresa: cliente.cliente_empresa || null,
    cliente_telefono: cliente.cliente_telefono || null,
    cliente_email: cliente.cliente_email || null,
    cliente_nit: cliente.cliente_nit || null,
    descuento_pct: descuentoPct,
    vigencia_dias: Number(vigencia) || 15,
    condiciones_comerciales: condiciones ?? config?.condiciones_comerciales,
    observaciones: observaciones || null,
    items: tipo === 'general' ? [] : lineas.map((l) => ({
      perfume_id: l.perfume_id,
      perfume_nombre: l.perfume_nombre,
      formula_volumen_id: l.formula_volumen_id,
      volumen_nombre: l.volumen_nombre,
      cantidad: l.cantidad,
      accesorios_seleccionados: l.accesorios_seleccionados,
      desglose_costo: l.desglose_costo,
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
    })),
  });

  const guardar = async (): Promise<Cotizacion | null> => {
    const fallo = (msg: string) => { setError(msg); toast.error(msg); return null; };
    if (!cliente.cliente_nombre.trim()) return fallo('Escribe el nombre del cliente');
    if (tipo === 'general' && volumenesSel.length === 0) return fallo('Marca al menos un tamaño para la lista de precios');
    if (tipo === 'detallada' && lineas.length === 0) return fallo('Agrega al menos un producto');
    setGuardando(true); setError('');
    try {
      const res = guardada
        ? await http.patch<{ data: Cotizacion }>(urls.cotizaciones.cotizacion(guardada.id), construirPayload())
        : await http.post<{ data: Cotizacion }>(urls.cotizaciones.crear, construirPayload());
      if (!res.ok || !res.cuerpo) return fallo(res.error || 'No se pudo guardar la cotización');
      setGuardada(res.cuerpo.data);
      onGuardada();
      toast.success('Cotización guardada');
      return res.cuerpo.data;
    } finally { setGuardando(false); }
  };

  /**
   * Guarda y descarga el PDF ya persistido. Siempre guarda primero: así el
   * documento lleva su número definitivo y refleja lo último que se editó.
   */
  const descargarPdf = async () => {
    const doc = await guardar();
    if (doc && config) descargarCotizacionPdf(doc, config);
  };

  const enviarWhatsapp = async () => {
    const doc = await guardar();
    if (!doc || !config) return;
    descargarCotizacionPdf(doc, config);
    // Si el sello de "enviada" no cuaja, se avisa pero se sigue: el PDF ya está
    // en el disco del dueño y cortarle el WhatsApp aquí no arregla nada.
    const sello = await http.patch(urls.cotizaciones.estado(doc.id), { estado: 'enviada' });
    if (!sello.ok) toast.error(sello.error, { id: 'cotizaciones' });
    // Con teléfono se abre el chat del cliente; sin él, WhatsApp deja elegir el
    // contacto (abrir el chat propio no le sirve a nadie).
    const tel = (doc.cliente_telefono || '').replace(/\D/g, '');
    const destino = tel ? (tel.length <= 10 ? `57${tel}` : tel) : '';
    window.open(`https://wa.me/${destino}?text=${encodeURIComponent(mensajeWhatsappCotizacion(doc))}`, '_blank');
    toast.success('Se abrió WhatsApp. Adjunta el PDF que se acaba de descargar.');
    onGuardada();
  };

  if (cargando) return <Section><PerfumeSpinner /></Section>;

  return (
    <Section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft className="size-4" /> Volver a cotizaciones
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={descargarPdf} disabled={guardando || sinContenido}>
            <Download className="size-4" /> Descargar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={enviarWhatsapp} disabled={guardando || sinContenido}>
            <MessageCircle className="size-4" /> Enviar por WhatsApp
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando}>
            <Save className="size-4" /> {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <h2 className="font-display text-xl font-medium text-foreground">
        {guardada ? `Cotización ${guardada.numero}` : 'Nueva cotización'}
      </h2>

      {/* Tipo: define qué se le muestra al cliente en el PDF */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {([
          { v: 'detallada', t: 'Pedido concreto', d: 'Los perfumes que se va a llevar, con cantidades y total.' },
          { v: 'general', t: 'Lista de precios', d: 'Solo cuánto vale por cantidad, sin decir qué fragancias.' },
        ] as const).map(({ v, t, d }) => (
          <button key={v} type="button" onClick={() => setTipo(v)}
            className={`rounded-xl border p-3.5 text-left transition-colors ${
              tipo === v ? 'border-primary bg-brand-soft' : 'border-border bg-card hover:border-primary/40'
            }`}>
            <p className={`text-[14px] font-medium ${tipo === v ? 'text-primary' : 'text-foreground'}`}>
              {tipo === v ? '● ' : '○ '}{t}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{d}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {/* Cliente */}
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cliente</h3>
          <FieldRow>
            <Field label="Nombre de contacto *">
              <Input value={cliente.cliente_nombre} maxLength={150}
                onChange={(e) => setCliente((c) => ({ ...c, cliente_nombre: e.target.value }))} />
            </Field>
            <Field label="Empresa (opcional)">
              <Input value={cliente.cliente_empresa} maxLength={150}
                onChange={(e) => setCliente((c) => ({ ...c, cliente_empresa: e.target.value }))} />
            </Field>
          </FieldRow>
          <FieldRow className="mt-3">
            <Field label="Teléfono / WhatsApp">
              <Input value={cliente.cliente_telefono} maxLength={30} placeholder="3001234567"
                onChange={(e) => setCliente((c) => ({ ...c, cliente_telefono: e.target.value }))} />
            </Field>
            <Field label="Correo">
              <Input value={cliente.cliente_email} maxLength={150}
                onChange={(e) => setCliente((c) => ({ ...c, cliente_email: e.target.value }))} />
            </Field>
            <Field label="NIT / CC">
              <Input value={cliente.cliente_nit} maxLength={50}
                onChange={(e) => setCliente((c) => ({ ...c, cliente_nit: e.target.value }))} />
            </Field>
          </FieldRow>
        </div>

        {/* Productos (pedido concreto) o tamaños a listar (lista de precios) */}
        {tipo === 'detallada' ? (
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Productos</h3>
            <LineasCotizacion
              lineas={lineas} perfumes={perfumes} formulas={formulas} insumos={insumos}
              costoAbierto={costoAbierto} onCostoAbierto={setCostoAbierto} onChange={setLineas}
            />

            {/* Insumos que van UNA sola vez en el pedido completo */}
            {extrasDisponibles.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-card p-3.5">
                <p className="text-[13px] font-medium text-foreground">Extras de todo el pedido</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                  Van una sola vez en el envío completo, no por perfume (una caja, un obsequio…).
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {extrasDisponibles.map((a) => {
                    const activo = extras.some((e) => e.insumo_id === a.id);
                    return (
                      <button key={a.id} type="button" onClick={() => toggleExtra(a)}
                        className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                          activo ? 'border-primary bg-brand-soft font-medium text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}>
                        {activo ? '✓ ' : '+ '}{a.nombre}
                      </button>
                    );
                  })}
                </div>
                {costoExtras > 0 && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Te cuestan <strong className="text-foreground">{formatPrice(costoExtras)}</strong> en
                    total (dato interno, no sale en el PDF).
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Tamaños a cotizar
            </h3>
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              Marca los tamaños que quieres mostrar. El cliente verá los precios por cantidad,
              sin fragancias concretas — ideal para que pida lo que quiera.
            </p>
            <div className="flex flex-col gap-2">
              {formulas.map((f) => {
                const marcado = volumenesSel.includes(f.id);
                const sinPrecios = f.escalas.length === 0;
                return (
                  <button key={f.id} type="button" disabled={sinPrecios}
                    onClick={() => setVolumenesSel((prev) =>
                      prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id])}
                    className={`rounded-xl border p-3.5 text-left transition-colors ${
                      sinPrecios ? 'cursor-not-allowed border-border bg-secondary/40 opacity-70'
                        : marcado ? 'border-primary bg-brand-soft' : 'border-border bg-card hover:border-primary/40'
                    }`}>
                    <p className={`text-[14px] font-medium ${marcado ? 'text-primary' : 'text-foreground'}`}>
                      {sinPrecios ? '○ ' : marcado ? '✓ ' : '○ '}{f.nombre}
                    </p>
                    {sinPrecios ? (
                      <p className="mt-0.5 text-[12px] text-amber-700">
                        Sin precios por cantidad: defínelos en "Tamaños y fórmulas" para poder incluirlo.
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {f.escalas.map((e) => `${e.cantidad_min}${e.cantidad_max ? `–${e.cantidad_max}` : '+'} u: ${formatPrice(e.precio)}`).join(' · ')}
                      </p>
                    )}
                  </button>
                );
              })}
              {formulas.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">
                  Aún no has creado tamaños.
                </p>
              )}
            </div>

            {/* La lista de precios NO dice qué fragancias lleva, así que no hay
                una esencia con la cual costear: se usa el promedio de cada gama.
                Antes esta cotización no mostraba ni costo ni margen. */}
            {volumenesSel.length > 0 && (
              <div className="mt-3">
                <MargenPorGama
                  formulas={formulas.filter((f) => volumenesSel.includes(f.id))}
                  insumos={insumos}
                  gamas={gamas}
                  descuentoPct={descuentoPct}
                />
              </div>
            )}
          </div>
        )}

        {/* Totales + rentabilidad interna: solo aplica al pedido concreto.
            Una lista de precios no tiene total ni utilidad (aún no hay pedido). */}
        <div className={`grid gap-4 sm:grid-cols-2 ${tipo === 'general' ? 'hidden' : ''}`}>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Resumen</h3>
            <FieldRow>
              <Field label="Descuento global (%)">
                <Input type="number" min="0" max="100" value={descuento}
                  onChange={(e) => setDescuento(e.target.value)} />
              </Field>
              <Field label="Vigencia (días)">
                <Input type="number" min="1" value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)} />
              </Field>
            </FieldRow>
            <div className="mt-3 space-y-1 border-t border-border/70 pt-3 text-[13px]">
              <p className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span className="tabular-nums text-foreground">{formatPrice(subtotal)}</span>
              </p>
              {descuentoPct > 0 && (
                <p className="flex justify-between text-muted-foreground">
                  <span>Descuento {descuentoPct}%</span>
                  <span className="tabular-nums text-primary">− {formatPrice(subtotal - total)}</span>
                </p>
              )}
              <p className="flex justify-between border-t border-border/70 pt-1.5 text-[15px] font-semibold">
                <span className="text-foreground">Total</span>
                <span className="tabular-nums text-primary">{formatPrice(total)}</span>
              </p>
            </div>
          </div>

          {/* Solo admin: nunca sale en el PDF */}
          <div className="rounded-xl border border-primary/25 bg-brand-soft/40 p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              <TrendingUp className="size-3.5" /> Rentabilidad (interno)
            </h3>
            <div className="space-y-1 text-[13px]">
              <p className="flex justify-between text-muted-foreground">
                <span>Costo de producción</span><span className="tabular-nums text-foreground">{formatPrice(rent.costoTotal)}</span>
              </p>
              <p className="flex justify-between text-muted-foreground">
                <span>Ingreso</span><span className="tabular-nums text-foreground">{formatPrice(rent.ingresoTotal)}</span>
              </p>
              <p className="flex justify-between border-t border-primary/20 pt-1.5 text-[15px] font-semibold">
                <span className="text-foreground">Utilidad</span>
                <span className={`tabular-nums ${faltanPrecios ? 'text-muted-foreground' : rent.utilidad >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {faltanPrecios ? '—' : formatPrice(rent.utilidad)}
                </span>
              </p>
              {!faltanPrecios && (
                <p className="text-right text-[12px] text-muted-foreground">Margen: {rent.margenPct}%</p>
              )}
            </div>

            {/* Sin precios el cálculo no significa nada: se explica en vez de
                mostrar una pérdida enorme que asusta sin motivo. */}
            {faltanPrecios ? (
              <p className="mt-3 rounded-lg bg-amber-400/15 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                Falta ponerle precio a {sinPrecio === 1 ? 'un producto' : `${sinPrecio} productos`}.
                Cuando escribas cuánto vas a cobrar, aquí verás tu ganancia real.
              </p>
            ) : (
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                Esta información es interna: no aparece en el PDF ni en el mensaje que recibe el cliente.
              </p>
            )}
          </div>
        </div>

        {/* Condiciones comerciales */}
        {condiciones && (
          <div>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Condiciones comerciales
            </h3>
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              Vienen de tu configuración; puedes ajustarlas solo para esta cotización.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS_CONDICIONES.map(({ k, label }) => (
                <Field key={k} label={label}>
                  <Input value={condiciones[k] ?? ''} maxLength={500}
                    onChange={(e) => setCondiciones((c) => (c ? { ...c, [k]: e.target.value } : c))} />
                </Field>
              ))}
            </div>
            <Field label="Observaciones" className="mt-3">
              <Textarea rows={3} maxLength={2000} value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)} />
            </Field>
          </div>
        )}

        {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
      </div>
    </Section>
  );
}
