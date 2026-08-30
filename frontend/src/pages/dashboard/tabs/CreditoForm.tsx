import { hoy } from '../../../utils/fechas';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import { detectarCombos } from '../../../application/hooks/useComboDetector';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import { ArmadorPedido } from '../pedido/ArmadorPedido';
import { mostrarAvisos, type Respuesta } from '../../../application/avisosInventario';
import { ResumenPedido } from '../pedido/ResumenPedido';
import {
  articulosDeLineas, descuentoDeCupon, itemsDeLineas, presentacionResumen, subtotalDeLineas,
  type LineaPedido,
} from '../pedido/lineasPedido';
import {
  formatPrice, parseClienteSeleccion, personaLabel, validarCodigoDescuento,
} from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { BloqueCampos, Field, FieldRow, FormError } from '../ui';
import type { CodigoValidado, ClienteSeleccion, Credito, Usuario } from '../types';
import { fechaLimitePorDefecto } from '../../../utils/fechas';

interface CreditoFormProps {
  open: boolean;
  /** null = crédito nuevo. */
  credito: Credito | null;
  usuarios: Usuario[];
  catalogo: Perfume[];
  combos: Combo[];
  onClose: () => void;
  onSaved: (creoPersona: boolean) => void;
}

interface EstadoForm {
  fecha: string;
  fecha_limite: string;
  user_id: ClienteSeleccion;
  lineas: LineaPedido[];
  aplicar_combo: boolean;
  /** Texto libre, solo para créditos viejos sin líneas. */
  articulos: string;
  deuda_inicial: string;
  /** true = la deuda se tecleó a mano y deja de seguir al cálculo. */
  deuda_manual: boolean;
  codigo_descuento: string;
  nuevo_nombre: string; nuevo_apellido: string; nuevo_correo: string;
  nuevo_telefono: string; nuevo_direccion: string;
}


const vacio = (): EstadoForm => ({
  fecha: hoy(), fecha_limite: fechaLimitePorDefecto(hoy()), user_id: '',
  lineas: [], aplicar_combo: false, articulos: '',
  deuda_inicial: '', deuda_manual: false, codigo_descuento: '',
  nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '',
  nuevo_telefono: '', nuevo_direccion: '',
});

/**
 * Crear o editar un crédito.
 *
 * Comparte con Ventas el armador de líneas y el resumen. Lo propio del crédito:
 * la fecha límite pactada, que el precio de combo NO se aplica solo, y que el
 * cupón se consume al instante (no espera a que termine de pagar).
 */
export function CreditoForm({
  open, credito, usuarios, catalogo, combos, onClose, onSaved,
}: CreditoFormProps) {
  const [form, setForm] = useState<EstadoForm>(vacio());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const porId = useMemo(() => new Map(catalogo.map(p => [p.id, p])), [catalogo]);

  const [codigoCheck, setCodigoCheck] = useState<CodigoValidado | null>(null);
  const [validando, setValidando] = useState(false);
  /** Cupón que ya traía el crédito al abrirlo a editar (para el desglose). */
  const [cuponPrefill, setCuponPrefill] = useState<{ descuento_pct: number; max_descuento: number } | null>(null);

  // ── Reconstruir el formulario al abrir ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(''); setCodigoCheck(null);
    if (!credito) {
      setForm(vacio()); setCuponPrefill(null);
      return;
    }
    const lineas: LineaPedido[] = credito.productos.map((prod, i) => {
      const p = porId.get(prod.perfume_id);
      const tallas = p?.precios ?? [];
      /**
       * La talla sale de la LÍNEA guardada. Antes se adivinaba del resumen de
       * texto del crédito y, si no coincidía, se cogía la primera del catálogo:
       * un crédito con dos tallas distintas volvía con las dos iguales, y al
       * guardar se descontaba del inventario algo que el cliente no se llevó.
       * Los créditos viejos no tienen `ml` y siguen cayendo en ese apaño, que
       * para ellos es lo único disponible.
       */
      const elegida = (prod.ml ? tallas.find(t => t.ml === prod.ml) : undefined)
        ?? tallas.find(t => t.presentacion === credito.presentacion)
        ?? tallas[0];
      return {
        key: `${prod.perfume_id}-${i}-${Date.now()}`,
        perfume_id: prod.perfume_id,
        nombre: p?.nombre ?? '',
        presentacion: elegida?.presentacion ?? null,
        ml: elegida?.ml ?? null,
        cantidad: prod.cantidad,
        regalo: prod.regalo ?? 0,
        sin_descuento: false,
      };
    });
    setForm({
      ...vacio(),
      fecha: credito.fecha.slice(0, 10),
      fecha_limite: credito.fecha_limite
        ? credito.fecha_limite.slice(0, 10)
        : fechaLimitePorDefecto(credito.fecha.slice(0, 10)),
      user_id: credito.cliente.id,
      lineas,
      articulos: credito.articulos,
      // La deuda guardada YA es el valor final: se preserva hasta tocar las líneas
      deuda_inicial: String(credito.deuda_inicial),
      deuda_manual: true,
      codigo_descuento: credito.codigo?.codigo ?? '',
    });
    setCuponPrefill(credito.codigo
      ? { descuento_pct: credito.codigo.descuento_pct, max_descuento: credito.codigo.max_descuento }
      : null);
  }, [open, credito, porId]);

  // ── Números ───────────────────────────────────────────────────────────────
  const subtotal = subtotalDeLineas(form.lineas, porId);
  const unidades = form.lineas.reduce((s, l) => s + l.cantidad, 0);

  /** A crédito el mayoreo NO se aplica solo: hay que encenderlo. */
  const ahorroCombo = useMemo(() => {
    if (!form.aplicar_combo || form.lineas.length === 0) return 0;
    return detectarCombos(itemsDeLineas(form.lineas, porId), combos)?.ahorroTotal ?? 0;
  }, [form.lineas, form.aplicar_combo, combos, porId]);

  const productosSubtotal = Math.max(0, subtotal - ahorroCombo);
  const cuponActivo = codigoCheck?.valido ? (codigoCheck.cupon ?? null) : cuponPrefill;
  const cuponPct = cuponActivo?.descuento_pct ?? 0;
  const descuentoCupon = descuentoDeCupon(productosSubtotal, cuponPct, cuponActivo?.max_descuento ?? 0);
  const deudaCalculada = Math.max(0, productosSubtotal - descuentoCupon);

  // La deuda sigue al cálculo mientras no se teclee a mano
  useEffect(() => {
    if (form.deuda_manual || form.lineas.length === 0) return;
    const v = String(deudaCalculada);
    setForm(f => (f.deuda_inicial === v ? f : { ...f, deuda_inicial: v }));
  }, [deudaCalculada, form.deuda_manual, form.lineas.length]);

  const textoArticulos = articulosDeLineas(form.lineas, porId);

  const validarCodigo = async () => {
    const codigo = form.codigo_descuento.trim();
    if (!codigo) { setCodigoCheck(null); return; }
    setValidando(true); setCodigoCheck(null);
    setCodigoCheck(await validarCodigoDescuento(codigo));
    setValidando(false);
  };

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setGuardando(true); setError('');

    let userId: number | '' = typeof form.user_id === 'number' ? form.user_id : '';
    let creoPersona = false;

    if (form.user_id === 'nuevo') {
      if (!form.nuevo_nombre.trim() || !form.nuevo_apellido.trim()) {
        setError('Nombre y apellido de la persona son obligatorios'); setGuardando(false); return;
      }
      try {
        const res = await http.post<{ data: { id: number } }>(urls.usuarios.crear, {
          nombre: form.nuevo_nombre.trim(), apellido: form.nuevo_apellido.trim(),
          email: form.nuevo_correo.trim() || undefined,
          telefono: form.nuevo_telefono.trim() || undefined,
          direccion: form.nuevo_direccion.trim() || undefined,
        });
        if (!res.ok || !res.cuerpo) { setError(res.error || 'Error al registrar la persona'); setGuardando(false); return; }
        userId = res.cuerpo.data.id; creoPersona = true;
      } catch { setError('No se pudo registrar la persona'); setGuardando(false); return; }
    }

    if (!userId) { setError('Selecciona o registra una persona'); setGuardando(false); return; }

    const articulos = (form.lineas.length ? textoArticulos : form.articulos).trim();
    if (!articulos) { setError('Agrega al menos un producto o describe los artículos'); setGuardando(false); return; }

    try {
      const body = {
        fecha: form.fecha,
        user_id: userId,
        articulos,
        // Líneas con su talla: es lo que deja al crédito descontar inventario.
        // Antes iban ids repetidos y sin talla, así que la mercancía salía por la
        // puerta y el sistema seguía contándola en bodega.
        lineas: form.lineas.map(l => ({
          perfume_id: l.perfume_id, ml: l.ml, cantidad: l.cantidad, regalo: l.regalo,
        })),
        presentacion: presentacionResumen(form.lineas) || null,
        // Valor FINAL: las líneas, el combo y el cupón ya están aplicados aquí
        deuda_inicial: Number(form.deuda_inicial),
        fecha_limite: form.fecha_limite || null,
        codigo_descuento: form.codigo_descuento.trim().toUpperCase() || null,
      };
      const res = credito
        ? await http.patch<Respuesta>(urls.creditos.credito(credito.id), body)
        : await http.post<Respuesta>(urls.creditos.crear, body);
      if (!res.ok) { setError(res.error); return; }
      mostrarAvisos(res.cuerpo);
      onSaved(creoPersona);
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setGuardando(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={credito ? 'Editar crédito' : 'Nuevo crédito'}
      onSubmit={handleSubmit}
      submitLabel={guardando ? 'Guardando...' : credito ? 'Guardar cambios' : 'Registrar crédito'}
      loading={guardando}
      maxWidth={620}
    >
      <BloqueCampos titulo="¿Cuándo y a quién?">
        <FieldRow>
          {/* Al mover la fecha, la límite se recorre con ella si no se tocó a mano */}
          <Field label="Fecha *">
            <Input type="date" required value={form.fecha}
              onChange={e => setForm(f => ({
                ...f,
                fecha: e.target.value,
                fecha_limite: f.fecha_limite === fechaLimitePorDefecto(f.fecha) ? fechaLimitePorDefecto(e.target.value) : f.fecha_limite,
              }))} />
          </Field>
          <Field label="Fecha límite de pago *">
            <Input type="date" required value={form.fecha_limite}
              onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
          </Field>
        </FieldRow>

        <Field label="Cliente *">
          <BuscadorSelect
            value={String(form.user_id)}
            placeholder="— Selecciona una persona —"
            opciones={[
              { id: '', nombre: '— Selecciona una persona —' },
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
              <Field label="Correo">
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
        <ArmadorPedido
          lineas={form.lineas}
          onChange={lineas => setForm(f => ({ ...f, lineas, deuda_manual: false }))}
          catalogo={catalogo}
          porId={porId}
          permitirSinDescuento
          permitirExtras
          placeholder="Buscar y agregar perfume…"
        />

        {form.lineas.length > 0 && combos.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2 text-[12.5px] text-foreground">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary"
              checked={form.aplicar_combo}
              onChange={e => setForm(f => ({ ...f, aplicar_combo: e.target.checked, deuda_manual: false }))} />
            <span>
              Aplicar precio de combo (mayoreo)
              <span className="block text-[11.5px] font-normal text-muted-foreground">
                A crédito no se aplica solo; enciéndelo si quieres darle el precio de combo.
                {ahorroCombo > 0 && <span className="font-medium text-primary"> Ahorro detectado: {formatPrice(ahorroCombo)}.</span>}
              </span>
            </span>
          </label>
        )}

        {form.lineas.length > 0 ? (
          <p className="rounded-lg bg-secondary/40 px-3 py-2 text-[12.5px] text-muted-foreground">
            {textoArticulos}
          </p>
        ) : (
          <Field label="Artículos (texto libre) *">
            <Textarea rows={2} value={form.articulos} maxLength={300}
              onChange={e => setForm(f => ({ ...f, articulos: e.target.value }))} />
          </Field>
        )}
      </BloqueCampos>

      <BloqueCampos titulo="¿Cuánto debe?">
        {form.lineas.length > 0 && (
          <ResumenPedido
            subtotal={subtotal}
            unidades={unidades}
            ahorroCombo={ahorroCombo}
            cupon={descuentoCupon > 0
              ? { codigo: form.codigo_descuento.trim().toUpperCase(), pct: cuponPct, descuento: descuentoCupon }
              : null}
            etiquetaTotal="Deuda del crédito"
          />
        )}

        <Field label="Deuda del crédito (COP) *">
          <Input type="number" min="1" required value={form.deuda_inicial}
            onChange={e => setForm(f => ({ ...f, deuda_inicial: e.target.value, deuda_manual: true }))} />
          {form.lineas.length > 0 && form.deuda_manual && String(deudaCalculada) !== form.deuda_inicial && (
            <button type="button" className="mt-1 text-[12px] text-primary underline"
              onClick={() => setForm(f => ({ ...f, deuda_inicial: String(deudaCalculada), deuda_manual: false }))}>
              Usar el calculado ({formatPrice(deudaCalculada)})
            </button>
          )}
        </Field>

        <Field label="Código de descuento (opcional, se canjea al crear)">
          <div className="flex gap-2">
            <Input
              value={form.codigo_descuento}
              placeholder="Ej: CP-7XK2M9"
              className="uppercase"
              onChange={e => { setForm(f => ({ ...f, codigo_descuento: e.target.value })); setCodigoCheck(null); setCuponPrefill(null); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validarCodigo(); } }}
            />
            <Button type="button" variant="outline" className="shrink-0"
              disabled={validando || !form.codigo_descuento.trim()} onClick={validarCodigo}>
              {validando ? 'Validando…' : 'Validar'}
            </Button>
          </div>

          {codigoCheck && (
            <p className={cn('mt-1.5 text-[12.5px] font-medium', codigoCheck.valido ? 'text-primary' : 'text-destructive')}>
              {codigoCheck.codigo}: {codigoCheck.motivo}
            </p>
          )}
          {cuponPrefill && !codigoCheck && (
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Este crédito ya usó el cupón {form.codigo_descuento} (−{cuponPrefill.descuento_pct}%).
              Bórralo si quieres quitarlo.
            </p>
          )}
          {cuponPct > 0 && productosSubtotal > 0 && (
            <p className="mt-1.5 rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2 text-[12px] text-primary">
              El cupón queda usado para siempre. Si no salda antes del {form.fecha_limite},
              el cupo del cliente baja el doble.
            </p>
          )}
        </Field>
      </BloqueCampos>

      <FormError>{error}</FormError>
    </Modal>
  );
}
