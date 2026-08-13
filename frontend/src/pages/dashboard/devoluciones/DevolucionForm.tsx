import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectSimple } from '@/components/ui/select-simple';
import { Button } from '@/components/ui/button';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import { BASE_URL } from '../../../infrastructure/api/client';
import { formatPrice, fmtDate } from '../helpers';
import { Field, FieldRow } from '../ui';
import { MOTIVOS, ESTADOS, SOLUCIONES } from '../../../domain/entities/devolucion.labels';
import { calcularDesgloseCosto } from '../../../application/costeoCotizacion';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';
import type { GuardedFetch } from '../types';
import type {
  Devolucion, DevolucionEstado, DevolucionMotivo, DevolucionSolucion, VentaParaDevolucion,
} from '../types';

interface Props {
  guardedFetch: GuardedFetch;
  /** Devolución a editar; null = nueva. */
  devolucion: Devolucion | null;
  onClose: () => void;
  onGuardada: () => void;
}

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Alta y edición de una devolución. Siempre arranca eligiendo la VENTA: de ahí
 * salen los productos que pueden volver y el tope de dinero que se puede
 * devolver. Registrar una devolución suelta dejaría los ingresos descuadrados.
 */
export default function DevolucionForm({ guardedFetch, devolucion, onClose, onGuardada }: Props) {
  const [ventas, setVentas] = useState<VentaParaDevolucion[]>([]);
  const [ventaId, setVentaId] = useState<number | null>(devolucion?.venta_id ?? null);
  const [fecha, setFecha] = useState(devolucion?.fecha ?? hoy());
  const [motivo, setMotivo] = useState<DevolucionMotivo>(devolucion?.motivo ?? 'llego_danado');
  const [detalle, setDetalle] = useState(devolucion?.detalle ?? '');
  const [estado, setEstado] = useState<DevolucionEstado>(devolucion?.estado ?? 'pendiente');
  const [solucion, setSolucion] = useState<DevolucionSolucion | ''>(devolucion?.solucion ?? '');
  const [monto, setMonto] = useState(String(devolucion?.monto_devuelto ?? 0));
  const [notas, setNotas] = useState(devolucion?.notas ?? '');
  const [lineas, setLineas] = useState(devolucion?.perfumes ?? []);
  // Costeo de lo repuesto: se valora al COSTO de producción, no al precio de
  // venta (esa plata ya la cobraste en la venta original).
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [insumosCat, setInsumosCat] = useState<Insumo[]>([]);
  const [repoFormula, setRepoFormula] = useState<number | ''>(devolucion?.reposicion_formula_id ?? '');
  const [repoCantidad, setRepoCantidad] = useState(String(devolucion?.reposicion_cantidad || 1));
  const [costoEnvio, setCostoEnvio] = useState(String(devolucion?.costo_envio ?? 0));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await guardedFetch(`${BASE_URL}/api/devoluciones/ventas`);
        if (!r.ok) throw new Error();
        const lista: VentaParaDevolucion[] = (await r.json()).data ?? [];
        // Al editar (sobre todo un reclamo del cliente) la venta puede ser vieja
        // y no venir en las 30 recientes: se inyecta para que no salga vacía.
        const v = devolucion?.venta;
        setVentas(v && !lista.some((x) => x.id === v.id)
          ? [{ ...v, perfumes: devolucion!.perfumes.map((p) => ({ ...p, cantidad: p.cantidad })) }, ...lista]
          : lista);
        const [rf, ri] = await Promise.all([
          guardedFetch(`${BASE_URL}/api/costeo/formulas`),
          guardedFetch(`${BASE_URL}/api/costeo/insumos`),
        ]);
        if (rf.ok) setFormulas((await rf.json()).data ?? []);
        if (ri.ok) setInsumosCat((await ri.json()).data ?? []);
      } catch {
        toast.error('No se pudieron cargar los datos', { id: 'dev-ventas' });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const venta = ventas.find((v) => v.id === ventaId) ?? null;
  const montoNum = Number(monto) || 0;
  // El tope real lo revalida el backend contra otras devoluciones de la misma venta
  const excede = venta ? montoNum > venta.valor_venta : false;

  // Lo que TE costó reponer: costo de producción × unidades. Nunca el precio de
  // venta — esa plata ya la cobraste y contarla sería duplicar la pérdida.
  const formulaRepo = formulas.find((f) => f.id === repoFormula) ?? null;
  const unidadesRepo = Number(repoCantidad) || 0;
  const costoUnitarioRepo = formulaRepo
    ? calcularDesgloseCosto(formulaRepo, insumosCat, formulaRepo.accesorios_default ?? []).costo_unitario
    : 0;
  const costoReposicion = Math.round(costoUnitarioRepo * unidadesRepo);
  const envioNum = Number(costoEnvio) || 0;
  const costoGarantia = montoNum + costoReposicion + envioNum;

  /** Suma o quita unidades de una fragancia de la venta. */
  const mover = (perfumeId: number, nombre: string, delta: number) => {
    setLineas((prev) => {
      const actual = prev.find((l) => l.perfume_id === perfumeId);
      const cantidad = (actual?.cantidad ?? 0) + delta;
      if (cantidad <= 0) return prev.filter((l) => l.perfume_id !== perfumeId);
      if (actual) return prev.map((l) => (l.perfume_id === perfumeId ? { ...l, cantidad } : l));
      return [...prev, { perfume_id: perfumeId, nombre, cantidad }];
    });
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const fallo = (m: string) => { toast.error(m, { id: m }); };
    if (!ventaId) return fallo('Elige la venta a la que pertenece esta devolución');
    if (estado === 'resuelta' && !solucion) return fallo('Di qué hiciste: repusiste o devolviste el dinero');
    if (solucion === 'devolucion_dinero' && estado === 'resuelta' && montoNum <= 0) {
      return fallo('Escribe cuánto dinero le devolviste');
    }
    if (montoNum > 0 && solucion !== 'devolucion_dinero') {
      return fallo('Solo se registra plata devuelta si la solución es "le devolví el dinero"');
    }

    setGuardando(true);
    try {
      const url = devolucion
        ? `${BASE_URL}/api/devoluciones/${devolucion.id}`
        : `${BASE_URL}/api/devoluciones`;
      const res = await guardedFetch(url, {
        method: devolucion ? 'PATCH' : 'POST',
        body: JSON.stringify({
          venta_id: ventaId,
          fecha,
          motivo,
          detalle: detalle.trim() || null,
          estado,
          solucion: solucion || null,
          monto_devuelto: montoNum,
          notas: notas.trim() || null,
          reposicion_formula_id: solucion === 'reposicion' ? (repoFormula || null) : null,
          reposicion_cantidad: solucion === 'reposicion' ? unidadesRepo : 0,
          costo_reposicion: solucion === 'reposicion' ? costoReposicion : 0,
          costo_envio: envioNum,
          perfumes: lineas.map((l) => ({ perfume_id: l.perfume_id, cantidad: l.cantidad })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return fallo(json?.error ?? 'No se pudo guardar la devolución');
      toast.success(devolucion ? 'Devolución actualizada' : 'Devolución registrada');
      onGuardada();
    } catch {
      fallo('No se pudo conectar con el servidor');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={devolucion ? `Devolución #${devolucion.id}` : 'Registrar devolución'}
      onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : 'Guardar'}
      loading={guardando}
      maxWidth={640}
    >
      <div className="space-y-4">
        {/* 1. La venta: de ella salen los productos y el tope de dinero */}
        <Field label="¿De qué venta es? *">
          <BuscadorSelect
            opciones={ventas.map((v) => ({
              id: v.id,
              nombre: `${fmtDate(v.dia)} · ${v.persona} · ${formatPrice(v.valor_venta)} — ${v.referencia_perfume}`,
            }))}
            value={ventaId}
            placeholder="Busca por cliente o por perfume…"
            onSelect={(id) => { setVentaId(Number(id)); setLineas([]); }}
            vacio="Sin ventas que coincidan"
          />
        </Field>

        {venta && (
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[12.5px]">
            <p className="text-muted-foreground">
              Venta del {fmtDate(venta.dia)} a <strong className="text-foreground">{venta.persona}</strong> por{' '}
              <strong className="text-foreground">{formatPrice(venta.valor_venta)}</strong>
            </p>
            {venta.perfumes.length > 0 && (
              <>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  ¿Qué unidades vuelven?
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {venta.perfumes.map((p) => {
                    const elegidas = lineas.find((l) => l.perfume_id === p.perfume_id)?.cantidad ?? 0;
                    return (
                      <li key={p.perfume_id} className="flex items-center justify-between gap-3">
                        <span className="text-foreground">{p.nombre} <span className="text-muted-foreground">({p.cantidad} u vendidas)</span></span>
                        <span className="flex items-center gap-1.5">
                          <Button type="button" size="icon" variant="outline" className="size-7"
                            onClick={() => mover(p.perfume_id, p.nombre, -1)} disabled={elegidas === 0}>−</Button>
                          <span className="w-6 text-center tabular-nums font-medium text-foreground">{elegidas}</span>
                          <Button type="button" size="icon" variant="outline" className="size-7"
                            onClick={() => mover(p.perfume_id, p.nombre, 1)} disabled={elegidas >= p.cantidad}>+</Button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {/* 2. El reclamo */}
        <FieldRow>
          <Field label="¿Qué día reportó? *">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Motivo *">
            <SelectSimple value={motivo} onChange={(e) => setMotivo(e.target.value as DevolucionMotivo)}>
              {MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </SelectSimple>
          </Field>
        </FieldRow>

        <Field label="Qué dijo el cliente">
          <Textarea rows={2} value={detalle} maxLength={2000}
            placeholder="Ej: el atomizador no rocía, se le derramó en la caja…"
            onChange={(e) => setDetalle(e.target.value)} />
        </Field>

        {/* 3. Cómo se cerró */}
        <FieldRow>
          <Field label="Estado">
            <SelectSimple value={estado} onChange={(e) => setEstado(e.target.value as DevolucionEstado)}>
              {ESTADOS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </SelectSimple>
          </Field>
          <Field label="¿Qué hiciste?">
            <SelectSimple value={solucion} onChange={(e) => {
              const v = e.target.value as DevolucionSolucion | '';
              setSolucion(v);
              if (v !== 'devolucion_dinero') setMonto('0');
            }}>
              <option value="">Todavía nada</option>
              {SOLUCIONES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </SelectSimple>
          </Field>
        </FieldRow>

        {/* Reposición: se valora al COSTO, nunca al precio de venta */}
        {solucion === 'reposicion' && (
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
            <p className="text-[12.5px] text-muted-foreground">
              ¿Qué le repusiste? Se valora a lo que te <strong className="text-foreground">cuesta
              producirlo</strong>, no al precio de venta: esa plata ya la cobraste en la venta
              original, y contarla otra vez duplicaría la pérdida.
            </p>
            <FieldRow className="mt-2">
              <Field label="Tamaño repuesto">
                <SelectSimple value={repoFormula}
                  onChange={(e) => setRepoFormula(Number(e.target.value) || '')}>
                  <option value="">— Elige —</option>
                  {formulas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </SelectSimple>
              </Field>
              <Field label="Unidades">
                <Input type="number" min="1" value={repoCantidad}
                  onChange={(e) => setRepoCantidad(e.target.value)} />
              </Field>
            </FieldRow>
            {costoReposicion > 0 && (
              <p className="mt-1.5 text-[12.5px] text-foreground">
                Te costó <strong className="text-primary">{formatPrice(costoReposicion)}</strong>
                {unidadesRepo > 1 && (
                  <span className="text-muted-foreground"> ({formatPrice(costoUnitarioRepo)} cada uno)</span>
                )}
              </p>
            )}
          </div>
        )}

        {solucion === 'devolucion_dinero' && (
          <Field label="¿Cuánto dinero le devolviste?">
            <Input type="number" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} />
            <p className={`mt-1 text-[12px] ${excede ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
              {excede
                ? `No puede pasar de ${formatPrice(venta!.valor_venta)}, que fue lo que costó la venta.`
                : 'Esta plata se descuenta de los ingresos del mes en que cierres el caso.'}
            </p>
          </Field>
        )}

        <Field label="Envío que pagaste por esta garantía">
          <Input type="number" min="0" value={costoEnvio}
            onChange={(e) => setCostoEnvio(e.target.value)} />
          <p className="mt-1 text-[12px] text-muted-foreground">
            Por ley el transporte de la garantía lo asumes tú (art. 11). Anótalo para que entre
            en la cuenta de lo que te costó el caso.
          </p>
        </Field>

        {costoGarantia > 0 && (
          <p className="rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2 text-[12.5px] text-primary">
            Esta garantía te cuesta <strong>{formatPrice(costoGarantia)}</strong>
            {montoNum > 0 && ` · ${formatPrice(montoNum)} devueltos`}
            {costoReposicion > 0 && ` · ${formatPrice(costoReposicion)} en producto`}
            {envioNum > 0 && ` · ${formatPrice(envioNum)} de envío`}
          </p>
        )}

        <Field label="Notas internas">
          <Textarea rows={2} value={notas} maxLength={2000}
            placeholder="Ej: reclamé a Interrapidísimo con la guía 123…"
            onChange={(e) => setNotas(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
