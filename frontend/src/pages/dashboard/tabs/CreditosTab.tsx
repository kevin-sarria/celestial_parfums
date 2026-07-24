import { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Gauge, Pencil, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { detectarCombos } from '../../../application/hooks/useComboDetector';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import PerfilCreditoModal from './PerfilCreditoModal';
import { creditosColumns } from '../columns';
import {
  precioUnitario, itemsDeLineas, articulosDeLineas, presentacionResumen, descuentoDeCupon,
} from '../creditoLineas';
import { API, API_COMBOS, API_CREDITOS, API_USUARIOS, DEFAULT_PAGE_SIZE, formatPrice, parseClienteSeleccion, personaLabel, validarCodigoDescuento } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError } from '../ui';
import type { GuardedFetch, Credito, CreditoForm, LineaCredito, CodigoValidado, PerfilCredito, Usuario } from '../types';
import { emptyCreditoForm, unMesDespues } from '../types';

interface CreditosTabProps {
  guardedFetch: GuardedFetch;
}

export function CreditosTab({ guardedFetch }: CreditosTabProps) {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CreditoForm>(emptyCreditoForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  // Certificación del cupón que se canjeará en el crédito
  const [codigoCheck, setCodigoCheck] = useState<CodigoValidado | null>(null);
  const [checking, setChecking] = useState(false);
  // Cupón ya canjeado que traía un crédito al editarlo (para el desglose)
  const [cuponPrefill, setCuponPrefill] = useState<{ descuento_pct: number; max_descuento: number } | null>(null);

  const [abonoModal, setAbonoModal] = useState<{ open: boolean; creditoId: number | null }>({ open: false, creditoId: null });
  const [abonoMonto, setAbonoMonto] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [perfil, setPerfil] = useState<PerfilCredito | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilUsuario, setPerfilUsuario] = useState<Usuario | null>(null);
  const [cupoEdit, setCupoEdit] = useState('');
  const [cupoSaving, setCupoSaving] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  // Catálogo completo (con precios y descuentos) y combos, para armar las líneas
  const [catalogo, setCatalogo] = useState<Perfume[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  // Los créditos cambian con cada acción; la lista de personas solo al montar
  const load = async (p = page, s = pageSize, term = searchTerm) => {
    const searchQs = term ? `&search=${encodeURIComponent(term)}` : '';
    const cRes = await guardedFetch(`${API_CREDITOS}?page=${p}&limit=${s}${searchQs}`);
    const cJson = await cRes.json();
    setCreditos(cJson.data ?? []);
    setTotal(cJson.total ?? 0);
    setPage(p);
  };

  const loadUsuarios = async () => {
    const uRes = await guardedFetch(API_USUARIOS);
    const uJson = await uRes.json();
    setUsuarios((uJson.data ?? []).filter((x: Usuario) => x.rol_id !== 1));
  };

  const loadCatalogo = async () => {
    const [pRes, cRes] = await Promise.all([fetch(`${API}/`), fetch(`${API_COMBOS}/`)]);
    const [pf, co] = await Promise.all([pRes.json(), cRes.json()]);
    setCatalogo((pf.data?.data ?? []) as Perfume[]);
    setCombos(((co.data ?? []) as Combo[]).filter(c => c.activo));
  };

  useEffect(() => { load(1); loadUsuarios(); loadCatalogo(); }, []);

  // ── Perfil crediticio interno (cupo, comportamiento, veto) ────────────────
  const openPerfil = async (userId: number) => {
    setPerfilOpen(true); setPerfil(null);
    setPerfilUsuario(usuarios.find(u => u.id === userId) ?? null);
    try {
      const res = await guardedFetch(`${API_USUARIOS}/${userId}/perfil-credito`);
      const json = await res.json();
      if (res.ok) { setPerfil(json.data); setCupoEdit(String(json.data.cupo_base ?? 0)); }
    } catch { /* el modal muestra el estado de carga */ }
  };

  const saveCupo = async () => {
    if (!perfil || !perfilUsuario) return;
    setCupoSaving(true);
    try {
      const res = await guardedFetch(`${API_USUARIOS}/${perfil.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: perfilUsuario.nombre, apellido: perfilUsuario.apellido,
          email: perfilUsuario.email,
          cupo_base: Number(cupoEdit) || 0,
        }),
      });
      if (res.ok) await openPerfil(perfil.user_id);
      else alert('No se pudo guardar el cupo');
    } finally { setCupoSaving(false); }
  };

  // ── Editor de líneas: precios, descuentos y combo ─────────────────────────
  const perfumePorId = useMemo(() => new Map(catalogo.map(p => [p.id, p])), [catalogo]);

  const rawSubtotal = form.lineas.reduce((s, l) => s + precioUnitario(l, perfumePorId) * l.cantidad, 0);
  const deteccionCombo = useMemo(
    () => (form.aplicar_combo ? detectarCombos(itemsDeLineas(form.lineas, perfumePorId), combos) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.lineas, form.aplicar_combo, combos, catalogo],
  );
  const ahorroCombo = deteccionCombo?.ahorroTotal ?? 0;
  // "Valor de los productos" = líneas − combo (antes del cupón)
  const productosSubtotal = Math.max(0, rawSubtotal - ahorroCombo);

  // Cupón activo: el recién validado, o el que ya traía el crédito al editar.
  // El descuento se calcula en el FRONT y la deuda que se guarda ya viene neta.
  const cuponActivo = codigoCheck?.valido ? (codigoCheck.cupon ?? null) : cuponPrefill;
  const cuponPct = cuponActivo?.descuento_pct ?? 0;
  const descuentoCupon = descuentoDeCupon(productosSubtotal, cuponPct, cuponActivo?.max_descuento ?? 0);
  // Deuda calculada (final) desde las líneas y el cupón
  const deudaCalculada = Math.max(0, productosSubtotal - descuentoCupon);

  // La deuda (valor FINAL) se sincroniza con las líneas mientras no se edite a mano
  useEffect(() => {
    if (form.deuda_manual || form.lineas.length === 0) return;
    const v = String(deudaCalculada);
    setForm(f => (f.deuda_inicial === v ? f : { ...f, deuda_inicial: v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deudaCalculada, form.deuda_manual, form.lineas.length]);

  // Texto de artículos y resumen de tallas generados de las líneas
  const textoArticulos = articulosDeLineas(form.lineas, perfumePorId);
  const resumenPresentacion = presentacionResumen(form.lineas);

  // Agregar un perfume: si ya existe esa fragancia+talla, suma cantidad
  const addPerfume = (id: number) => {
    const p = perfumePorId.get(id);
    if (!p) return;
    const presentacion = p.presentaciones[0] ?? '30ML';
    setForm(f => {
      const i = f.lineas.findIndex(l => l.perfume_id === id && l.presentacion === presentacion);
      const lineas = [...f.lineas];
      if (i >= 0) lineas[i] = { ...lineas[i], cantidad: lineas[i].cantidad + 1 };
      else lineas.push({ key: `${id}-${presentacion}-${Date.now()}`, perfume_id: id, presentacion, cantidad: 1, sin_descuento: false });
      // Cambió una línea: se recalcula la deuda desde el subtotal
      return { ...f, lineas, deuda_manual: false };
    });
  };
  const setLinea = (key: string, patch: Partial<LineaCredito>) =>
    setForm(f => ({ ...f, deuda_manual: false, lineas: f.lineas.map(l => (l.key === key ? { ...l, ...patch } : l)) }));
  const removeLinea = (key: string) =>
    setForm(f => ({ ...f, deuda_manual: false, lineas: f.lineas.filter(l => l.key !== key) }));

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    let userId: number | '' = typeof form.user_id === 'number' ? form.user_id : '';

    if (form.user_id === 'nuevo') {
      if (!form.nuevo_nombre.trim() || !form.nuevo_apellido.trim()) {
        setError('Nombre y apellido de la persona son obligatorios'); setLoading(false); return;
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
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Error al registrar la persona'); setLoading(false); return; }
        userId = json.data.id;
        loadUsuarios(); // la persona recién creada debe aparecer en el desplegable
      } catch { setError('No se pudo registrar la persona'); setLoading(false); return; }
    }

    if (!userId) { setError('Selecciona o registra una persona'); setLoading(false); return; }

    // Productos: del editor de líneas (o del texto libre si no se usó)
    const articulos = (form.lineas.length ? textoArticulos : form.articulos).trim();
    if (!articulos) { setError('Agrega al menos un producto o describe los artículos'); setLoading(false); return; }
    // ids REPETIDOS por cantidad (el backend usa agruparEnlaces)
    const perfume_ids = form.lineas.flatMap(l => Array(l.cantidad).fill(l.perfume_id) as number[]);

    try {
      const body = {
        fecha: form.fecha,
        user_id: userId,
        articulos,
        perfume_ids,
        presentacion: resumenPresentacion || null,
        // Valor FINAL de la deuda (las líneas y el cupón ya se aplicaron aquí)
        deuda_inicial: Number(form.deuda_inicial),
        fecha_limite: form.fecha_limite || null,
        codigo_descuento: form.codigo_descuento.trim().toUpperCase() || null,
      };
      const url = editId ? `${API_CREDITOS}/${editId}` : API_CREDITOS;
      const res = await guardedFetch(url, { method: editId ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      setModal(false); load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const validarCodigo = async () => {
    const codigo = form.codigo_descuento.trim();
    if (!codigo) { setCodigoCheck(null); return; }
    setChecking(true); setCodigoCheck(null);
    setCodigoCheck(await validarCodigoDescuento(guardedFetch, codigo));
    setChecking(false);
  };

  const abrirNuevo = () => {
    setEditId(null); setForm(emptyCreditoForm());
    setError(''); setCodigoCheck(null); setCuponPrefill(null); setModal(true);
  };

  // Reconstruye el formulario desde un crédito existente para editarlo
  const abrirEditar = (c: Credito) => {
    const lineas: LineaCredito[] = c.productos.map((prod, i) => {
      const p = perfumePorId.get(prod.perfume_id);
      // Talla: si el resumen del crédito es una sola conocida, se usa; si no, la primera
      const tallas = p?.presentaciones ?? [];
      const presentacion = tallas.includes(c.presentacion) ? c.presentacion : (tallas[0] ?? (c.presentacion || '30ML'));
      return { key: `${prod.perfume_id}-${i}-${Date.now()}`, perfume_id: prod.perfume_id, presentacion, cantidad: prod.cantidad, sin_descuento: false };
    });
    setEditId(c.id);
    setForm({
      fecha: c.fecha.slice(0, 10),
      user_id: c.cliente.id,
      nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '', nuevo_telefono: '', nuevo_direccion: '',
      articulos: c.articulos,
      // La deuda guardada YA es el valor final; se preserva (manual) hasta tocar líneas
      deuda_inicial: String(c.deuda_inicial),
      lineas, aplicar_combo: false, deuda_manual: true,
      fecha_limite: c.fecha_limite ? c.fecha_limite.slice(0, 10) : unMesDespues(c.fecha.slice(0, 10)),
      codigo_descuento: c.codigo?.codigo ?? '',
    });
    setCuponPrefill(c.codigo ? { descuento_pct: c.codigo.descuento_pct, max_descuento: c.codigo.max_descuento } : null);
    setCodigoCheck(null); setError(''); setModal(true);
  };

  const handleAbono = async () => {
    if (!abonoModal.creditoId || !abonoMonto) return;
    const res = await guardedFetch(`${API_CREDITOS}/${abonoModal.creditoId}/abono`, {
      method: 'PATCH', body: JSON.stringify({ monto: Number(abonoMonto) }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? 'Error'); return; }
    setAbonoModal({ open: false, creditoId: null }); setAbonoMonto(''); load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este credito?')) return;
    await guardedFetch(`${API_CREDITOS}/${id}`, { method: 'DELETE' }); load();
  };

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={total}>Creditos</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="creditos" guardedFetch={guardedFetch} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={abrirNuevo}>
              + Nuevo credito
            </Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={creditosColumns}
          rows={creditos}
          rowKey={c => c.id}
          onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={c => (
            <>
              <Button
                variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary"
                title="Perfil crediticio (cupo y comportamiento)"
                onClick={() => openPerfil(c.cliente.id)}
              >
                <Gauge className="size-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary"
                title="Registrar abono"
                onClick={() => { setAbonoModal({ open: true, creditoId: c.id }); setAbonoMonto(''); }}
              >
                <CircleDollarSign className="size-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground"
                title="Editar crédito"
                onClick={() => abrirEditar(c)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)} title="Eliminar">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        />
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="creditos"
        guardedFetch={guardedFetch}
        onImported={() => load(1)}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Editar crédito' : 'Nuevo credito'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : editId ? 'Guardar cambios' : 'Registrar credito'}
        loading={loading}
      >
        <FieldRow>
          {/* Al cambiar la fecha, la fecha límite se recorre un mes (si no la tocó a mano) */}
          <Field label="Fecha *">
            <Input type="date" required value={form.fecha}
              onChange={e => setForm(f => ({
                ...f,
                fecha: e.target.value,
                fecha_limite: f.fecha_limite === unMesDespues(f.fecha) ? unMesDespues(e.target.value) : f.fecha_limite,
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
              <Field label="Telefono">
                <Input value={form.nuevo_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nuevo_telefono: e.target.value }))} />
              </Field>
              <Field label="Correo">
                <Input type="email" value={form.nuevo_correo} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nuevo_correo: e.target.value }))} />
              </Field>
            </FieldRow>
            <Field label="Direccion">
              <Input value={form.nuevo_direccion} maxLength={150}
                onChange={e => setForm(f => ({ ...f, nuevo_direccion: e.target.value }))} />
            </Field>
          </div>
        )}
        {/* ── Productos del crédito ── */}
        <Field label="Productos">
          <BuscadorSelect
            opciones={catalogo.map(p => ({ id: p.id, nombre: p.nombre }))}
            placeholder="Buscar y agregar perfume…"
            onSelect={id => addPerfume(Number(id))}
            vacio="Sin perfumes en el catálogo"
          />
          {form.lineas.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {form.lineas.map(l => {
                const p = perfumePorId.get(l.perfume_id);
                const tieneDesc = (p?.descuento ?? 0) > 0;
                return (
                  <div key={l.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2">
                    <span className="min-w-32 flex-1 text-[13px] font-medium text-foreground">{p?.nombre ?? `#${l.perfume_id}`}</span>
                    {/* Talla propia de esta línea (cambia su precio) */}
                    <NativeSelect
                      value={l.presentacion}
                      className="h-8 w-24 text-[12.5px]"
                      onChange={e => setLinea(l.key, { presentacion: e.target.value })}
                    >
                      {(p?.presentaciones ?? [l.presentacion]).map(pr => <option key={pr} value={pr}>{pr}</option>)}
                    </NativeSelect>
                    <Input
                      type="number" min="1" value={l.cantidad}
                      className="h-8 w-16 text-[12.5px]"
                      onChange={e => setLinea(l.key, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                    />
                    {/* Quitar el descuento de la página (a crédito no aplica lo mismo que al contado) */}
                    {tieneDesc && (
                      <label className="flex cursor-pointer items-center gap-1 text-[11.5px] text-muted-foreground" title="Quitar el descuento de la página en esta línea">
                        <input type="checkbox" className="size-3.5 accent-primary"
                          checked={l.sin_descuento}
                          onChange={e => setLinea(l.key, { sin_descuento: e.target.checked })} />
                        sin −{p?.descuento}%
                      </label>
                    )}
                    <span className="w-24 text-right text-[12.5px] font-semibold text-foreground tabular-nums">
                      {formatPrice(precioUnitario(l, perfumePorId) * l.cantidad)}
                    </span>
                    <button type="button" aria-label="Quitar" className="rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLinea(l.key)}>
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Interruptor de combo (mayoreo): a crédito solo si tú lo activas */}
              {combos.length > 0 && (
                <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2 text-[12.5px] text-foreground">
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
            </div>
          )}
        </Field>

        {/* Texto de artículos: generado de las líneas, o manual si no hay líneas */}
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

        {/* ── Deuda y cupón ── */}
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
              disabled={checking || !form.codigo_descuento.trim()} onClick={validarCodigo}>
              {checking ? 'Validando…' : 'Validar'}
            </Button>
          </div>
          {codigoCheck && (
            <p className={cn('mt-1.5 text-[12.5px] font-medium', codigoCheck.valido ? 'text-primary' : 'text-destructive')}>
              {codigoCheck.codigo}: {codigoCheck.motivo}
            </p>
          )}
          {cuponPrefill && !codigoCheck && (
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Este crédito ya usó el cupón {form.codigo_descuento} (−{cuponPrefill.descuento_pct}%). Bórralo si quieres quitarlo.
            </p>
          )}
          {cuponPct > 0 && productosSubtotal > 0 && (
            <div className="mt-2 space-y-0.5 rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2 text-[12.5px] text-primary">
              <div className="flex justify-between"><span>Productos</span><span>{formatPrice(productosSubtotal)}</span></div>
              <div className="flex justify-between"><span>Cupón −{cuponPct}%</span><span>−{formatPrice(descuentoCupon)}</span></div>
              <div className="flex justify-between font-semibold"><span>Deuda del crédito</span><span>{formatPrice(deudaCalculada)}</span></div>
              <p className="pt-1 text-[11.5px] font-normal opacity-80">
                El cupón queda usado para siempre. Si no salda antes del {form.fecha_limite}, el cupo baja el doble.
              </p>
            </div>
          )}
        </Field>
        <FormError>{error}</FormError>
      </Modal>

      <Modal
        open={abonoModal.open}
        onClose={() => setAbonoModal({ open: false, creditoId: null })}
        title="Registrar abono"
        maxWidth={360}
        footer={
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAbonoModal({ open: false, creditoId: null })}>
              Cancelar
            </Button>
            <Button onClick={handleAbono} disabled={!abonoMonto}>Guardar abono</Button>
          </DialogFooter>
        }
      >
        <Field label="Monto del abono (COP)">
          <Input type="number" min="1" value={abonoMonto}
            onChange={e => setAbonoMonto(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAbono()} />
        </Field>
      </Modal>

      <PerfilCreditoModal
        open={perfilOpen}
        onClose={() => setPerfilOpen(false)}
        perfil={perfil}
        cupoEdit={cupoEdit}
        onCupoEdit={setCupoEdit}
        onGuardarCupo={saveCupo}
        guardando={cupoSaving}
      />
    </>
  );
}
