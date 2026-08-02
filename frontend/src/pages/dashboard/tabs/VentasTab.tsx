import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Link2, Pencil, Trash2, TriangleAlert, Upload, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { ventasColumns } from '../columns';
// Mismo cálculo del cupón que usan el carrito y los créditos (tope incluido)
import { descuentoDeCupon } from '../creditoLineas';
import { API, API_VENTAS, API_USUARIOS, DEFAULT_PAGE_SIZE, formatPrice, parseClienteSeleccion, personaLabel, validarCodigoDescuento } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, StatCard, StatRow } from '../ui';
import type { CodigoValidado, GuardedFetch, Venta, VentaForm, Usuario } from '../types';

/** Tallas en ml. La talla es un NÚMERO: así "30ML" y "30 ML" dejan de ser distintas. */
const TALLAS_ML = [6, 10, 20, 30, 50, 60, 75, 80, 100, 200, 250];
import { emptyVentaForm } from '../types';

interface VentasTabProps {
  guardedFetch: GuardedFetch;
}

interface PerfumeOption {
  id: number;
  nombre: string;
}

export function VentasTab({ guardedFetch }: VentasTabProps) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<{
    total_unidades: number;
    total_dinero: number;
    ingresos_mes: number;
    abonos_mes: number;
  } | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfumes, setPerfumes] = useState<PerfumeOption[]>([]);

  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<VentaForm>(emptyVentaForm());
  // Referencia libre de una venta importada que no coincidió con el catálogo
  const [referenciaInvalida, setReferenciaInvalida] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Ventas y totales cambian con cada acción; personas y catálogo solo al montar
  const load = async (p = page, s = pageSize, term = searchTerm) => {
    const searchQs = term ? `&search=${encodeURIComponent(term)}` : '';
    const [vRes, tRes] = await Promise.all([
      guardedFetch(`${API_VENTAS}?page=${p}&limit=${s}${searchQs}`),
      guardedFetch(`${API_VENTAS}/totales`),
    ]);
    const [v, t] = await Promise.all([vRes.json(), tRes.json()]);
    setVentas(v.data ?? []);
    setTotal(v.total ?? 0);
    setPage(p);
    setTotales(t.data ?? null);
  };

  const loadCatalogos = async () => {
    const [uRes, pRes] = await Promise.all([guardedFetch(API_USUARIOS), fetch(`${API}/`)]);
    const [u, pf] = await Promise.all([uRes.json(), pRes.json()]);
    setUsuarios((u.data ?? []).filter((x: Usuario) => x.rol_id !== 1));
    setPerfumes(
      ((pf.data?.data ?? []) as PerfumeOption[])
        .map((x) => ({ id: x.id, nombre: x.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    );
  };

  useEffect(() => { load(1); loadCatalogos(); }, []);

  // Certificación inline del código de descuento del pedido
  const [codigoCheck, setCodigoCheck] = useState<CodigoValidado | null>(null);
  const [checking, setChecking] = useState(false);
  /**
   * Código que YA tenía la venta al abrir el editor. Si sigue siendo el mismo,
   * el `valor_venta` guardado ya trae el descuento restado (así se registraron
   * todas las ventas hasta hoy) y volver a aplicarlo lo descontaría dos veces.
   */
  const [codigoOriginal, setCodigoOriginal] = useState('');
  /** El admin ya usó el botón "Aplicar" en esta sesión del formulario. */
  const [cuponAplicado, setCuponAplicado] = useState(false);
  /**
   * Alta rápida de un producto que no está en el catálogo (un 1.1 nuevo, una
   * gorra). Mismo patrón que "+ Registrar persona nueva": se crea sin salir de
   * la venta y la ficha se completa después.
   */
  const [nuevoProd, setNuevoProd] = useState<{ nombre: string; precio: string } | null>(null);
  const [creandoProd, setCreandoProd] = useState(false);

  const crearProductoAlVuelo = async () => {
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
      const creado = { id: json.data.id, nombre: json.data.nombre };
      setPerfumes((ps) => [...ps, creado].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setForm((fm) => ({
        ...fm,
        lineas: [...fm.lineas, { perfume_id: creado.id, nombre: creado.nombre, ml: null, cantidad: 1 }],
      }));
      setNuevoProd(null); setError('');
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setCreandoProd(false); }
  };

  const openCreate = () => {
    setForm(emptyVentaForm()); setReferenciaInvalida(''); setError(''); setCodigoCheck(null);
    setCodigoOriginal(''); setCuponAplicado(false);
    setModal({ open: true, editId: null });
  };
  const openEdit = (v: Venta) => {
    setForm({
      ...emptyVentaForm(),
      dia: v.dia.slice(0, 10), persona: v.persona,
      user_id: v.user_id ?? '',
      cantidad_perfumes: String(v.cantidad_perfumes), presentacion: v.presentacion,
      // Un id repetido = varias unidades de la misma fragancia
      perfume_ids: [],
      lineas: v.perfumes.map(p => ({ perfume_id: p.id, nombre: p.nombre, ml: p.ml ?? null, cantidad: p.cantidad ?? 1 })),
      valor_venta: String(v.valor_venta),
      datos_adicionales: v.datos_adicionales ?? '',
      pagada: v.pagada,
      codigo_descuento: v.codigo?.codigo ?? '',
    });
    // Venta importada cuya referencia libre no coincidió con ningún perfume
    setReferenciaInvalida(v.perfumes.length === 0 ? v.referencia_perfume : '');
    setError(''); setCodigoCheck(null);
    setCodigoOriginal(v.codigo?.codigo ?? ''); setCuponAplicado(false);
    setModal({ open: true, editId: v.id });
  };
  const closeModal = () => setModal({ open: false, editId: null });

  const validarCodigo = async () => {
    const codigo = form.codigo_descuento.trim();
    if (!codigo) return;
    setChecking(true); setCodigoCheck(null);
    setCodigoCheck(await validarCodigoDescuento(guardedFetch, codigo));
    setChecking(false);
  };

  /** Agrega el producto como línea nueva; si ya está sin talla, le suma una unidad. */
  const agregarLinea = (id: number) => {
    const p = perfumes.find((x) => x.id === id);
    if (!p) return;
    setForm((f) => {
      const i = f.lineas.findIndex((l) => l.perfume_id === id && l.ml === null);
      const lineas = i >= 0
        ? f.lineas.map((l, k) => (k === i ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...f.lineas, { perfume_id: id, nombre: p.nombre, ml: null, cantidad: 1 }];
      return { ...f, lineas, cantidad_perfumes: String(lineas.reduce((s, l) => s + l.cantidad, 0)) };
    });
  };

  /** Cambia talla o cantidad de una línea, fusionando si queda igual a otra. */
  const actualizarLinea = (idx: number, cambios: { ml?: number | null; cantidad?: number }) => {
    setForm((f) => {
      let lineas = f.lineas.map((l, i) => (i === idx ? { ...l, ...cambios } : l));
      // Si al cambiar la talla queda idéntica a otra línea, se suman
      const actual = lineas[idx];
      const gemela = lineas.findIndex((l, i) => i !== idx && l.perfume_id === actual.perfume_id && l.ml === actual.ml);
      if (gemela >= 0) {
        lineas[gemela] = { ...lineas[gemela], cantidad: lineas[gemela].cantidad + actual.cantidad };
        lineas = lineas.filter((_, i) => i !== idx);
      }
      return { ...f, lineas, cantidad_perfumes: String(lineas.reduce((s, l) => s + l.cantidad, 0)) };
    });
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');

    if (form.lineas.length === 0) {
      setError('Selecciona al menos un perfume del catálogo'); setLoading(false); return;
    }

    // Enlace de persona opcional: '' = sin enlace, 'nuevo' = crear ficha, número = existente.
    let userId: number | null = typeof form.user_id === 'number' ? form.user_id : null;

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
        if (!res.ok) { setError(json.error ?? 'Error al crear la persona'); setLoading(false); return; }
        userId = json.data.id;
      } catch { setError('No se pudo crear la persona'); setLoading(false); return; }
    }

    const body = {
      dia: form.dia, persona: form.persona.trim(),
      user_id: userId,
      cantidad_perfumes: Number(form.cantidad_perfumes),
      presentacion: form.presentacion,
      lineas: form.lineas.map(l => ({ perfume_id: l.perfume_id, ml: l.ml, cantidad: l.cantidad })),
      valor_venta: Number(form.valor_venta),
      datos_adicionales: form.datos_adicionales.trim() || null,
      pagada: form.pagada,
      codigo_descuento: form.codigo_descuento.trim().toUpperCase() || null,
    };
    try {
      const url = modal.editId ? `${API_VENTAS}/${modal.editId}` : API_VENTAS;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await guardedFetch(url, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      closeModal(); load();
      if (form.user_id === 'nuevo') loadCatalogos(); // la persona recién creada debe aparecer
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  /** Unidades totales del pedido, sumando todas las líneas. */
  const unidadesElegidas = form.lineas.reduce((s, l) => s + l.cantidad, 0);

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    await guardedFetch(`${API_VENTAS}/${id}`, { method: 'DELETE' }); load();
  };

  // ── Ayuda de cálculo del cupón ────────────────────────────────────────────
  // El valor de la venta se sigue tecleando a mano (es la plata que entró de
  // verdad); esto solo hace la cuenta y la ofrece, respetando el tope en pesos
  // de la campaña. Nunca se aplica solo.
  const cupon = codigoCheck?.valido ? codigoCheck.cupon : undefined;
  const valorTecleado = Number(form.valor_venta) || 0;
  /** Editando la misma venta con su mismo código: el valor ya viene descontado. */
  const cuponYaEnLaVenta = Boolean(modal.editId) && codigoOriginal !== ''
    && codigoOriginal.toUpperCase() === form.codigo_descuento.trim().toUpperCase();
  const noAlcanzaMinimo = !!cupon && cupon.min_monto > 0 && valorTecleado < cupon.min_monto;
  const descuentoCupon = cupon && !cuponYaEnLaVenta && !cuponAplicado && !noAlcanzaMinimo
    ? descuentoDeCupon(valorTecleado, cupon.descuento_pct, cupon.max_descuento)
    : 0;
  /** ¿El tope de la campaña recortó el porcentaje? (para explicarlo). */
  const topeRecorto = !!cupon && cupon.max_descuento > 0 && descuentoCupon > 0
    && Math.round((valorTecleado * cupon.descuento_pct) / 100) > cupon.max_descuento;

  const aplicarCupon = () => {
    setForm(f => ({ ...f, valor_venta: String(valorTecleado - descuentoCupon) }));
    setCuponAplicado(true);
  };

  const [enlazando, setEnlazando] = useState(false);
  // Reintenta la inferencia venta→perfumes para las ventas importadas sin enlazar
  const handleEnlazar = async () => {
    setEnlazando(true);
    try {
      const res = await guardedFetch(`${API_VENTAS}/enlazar-perfumes`, { method: 'POST' });
      const json = await res.json();
      alert(res.ok ? json.message : (json.error ?? 'Error al enlazar'));
      if (res.ok) load();
    } catch { alert('No se pudo conectar con el servidor'); }
    finally { setEnlazando(false); }
  };

  // Todos siguen disponibles: repetir uno suma otra unidad de esa fragancia

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={total}>Ventas</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="ventas" guardedFetch={guardedFetch} />
            <Button
              variant="outline" size="sm" disabled={enlazando}
              title="Intenta enlazar por nombre las ventas importadas que aún no tienen perfume del catálogo"
              onClick={handleEnlazar}
            >
              <Link2 className="size-4" /> {enlazando ? 'Enlazando…' : 'Enlazar perfumes'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={openCreate}>+ Registrar venta</Button>
          </ToolbarActions>
        </Toolbar>

        {totales && (
          <StatRow>
            <StatCard label="Total unidades vendidas" value={totales.total_unidades} />
            <StatCard label="Total en dinero" value={formatPrice(totales.total_dinero)} />
            {/* Plata que entró de verdad este mes: contado + abonos de créditos */}
            <StatCard
              label={`Ingresos este mes${totales.abonos_mes > 0 ? ` (incluye ${formatPrice(totales.abonos_mes)} de créditos)` : ''}`}
              value={formatPrice(totales.ingresos_mes)}
            />
          </StatRow>
        )}

        {/* La ganancia y el gráfico de meses viven en Reportes: aquí se registra
            y se busca, allá se mira cómo va el negocio. */}
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          ¿Cómo va el mes contra los anteriores?{' '}
          <Link to="/dashboard/rep_ventas" className="font-medium text-primary hover:underline">
            Míralo en Reportes
          </Link>
        </p>

        <SmartTable
          columns={ventasColumns}
          rows={ventas}
          rowKey={v => v.id}
          onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={v => (
            <>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(v)} title="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(v.id)} title="Eliminar">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        />
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="ventas"
        guardedFetch={guardedFetch}
        onImported={() => load(1)}
      />

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar venta' : 'Registrar venta'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Registrar'}
        loading={loading}
      >
        <FieldRow>
          <Field label="Dia *">
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
              <Field label="Telefono">
                <Input value={form.nuevo_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nuevo_telefono: e.target.value }))} />
              </Field>
              <Field label="Correo (si se registra con él, hereda su historial)">
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

        <Field label="Perfumes vendidos * (elige uno o varios del catálogo)">
          <div className="space-y-2">
            {referenciaInvalida && form.lineas.length === 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                "{referenciaInvalida}" no coincide con los perfumes registrados en la base de
                datos; por favor selecciona uno o varios válidos.
              </p>
            )}
            <BuscadorSelect
              opciones={[
                { id: 'nuevo', nombre: '+ Crear producto nuevo (no está en el catálogo)' },
                ...perfumes.map((p) => ({ id: p.id, nombre: p.nombre })),
              ]}
              placeholder="Buscar y agregar producto al pedido…"
              onSelect={(id) => {
                if (String(id) === 'nuevo') setNuevoProd({ nombre: '', precio: '' });
                else agregarLinea(Number(id));
              }}
            />

            {/* Alta rápida: lo mínimo para poder vender ya; el resto se
                completa después en la ficha del catálogo. */}
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
                      onChange={(e) => setNuevoProd({ ...nuevoProd, nombre: e.target.value })} />
                  </Field>
                  <Field label="Precio *">
                    <Input type="number" min="0" value={nuevoProd.precio}
                      onChange={(e) => setNuevoProd({ ...nuevoProd, precio: e.target.value })} />
                  </Field>
                </FieldRow>
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={creandoProd} onClick={crearProductoAlVuelo}>
                    {creandoProd ? 'Creando…' : 'Crear y agregar'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setNuevoProd(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/*
              Una LÍNEA por producto+talla. Antes era una lista de ids con UNA
              talla para toda la venta, así que "1 de 30 ml y 2 de 60 ml" no se
              podía registrar bien y era imposible saber qué descontar.
              Dos iguales se suman en la misma línea, no se duplican.
            */}
            {form.lineas.length > 0 && (
              <ul className="flex flex-col gap-2">
                {form.lineas.map((l, idx) => (
                  <li key={`${l.perfume_id}-${l.ml ?? 'sin'}`}
                    className="flex flex-wrap items-end gap-2.5 rounded-lg border border-border bg-secondary/40 p-2.5">
                    <p className="min-w-32 flex-1 text-[13.5px] font-medium text-foreground">{l.nombre}</p>

                    <Field label="Talla" className="w-28">
                      <NativeSelect className="h-9" value={l.ml ?? ''}
                        onChange={(e) => actualizarLinea(idx, { ml: Number(e.target.value) || null })}>
                        <option value="">Sin talla</option>
                        {TALLAS_ML.map((ml) => <option key={ml} value={ml}>{ml} ml</option>)}
                      </NativeSelect>
                    </Field>

                    <Field label="Cantidad" className="w-24">
                      <Input type="number" min="1" className="h-9" value={l.cantidad}
                        onChange={(e) => actualizarLinea(idx, { cantidad: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>

                    <Button type="button" size="icon" variant="ghost"
                      className="size-9 text-muted-foreground hover:text-destructive"
                      onClick={() => setForm((f) => ({ ...f, lineas: f.lineas.filter((_, i) => i !== idx) }))}>
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
                <li className="text-right text-[12px] text-muted-foreground">
                  {unidadesElegidas} {unidadesElegidas === 1 ? 'unidad' : 'unidades'} en total
                </li>
              </ul>
            )}
          </div>
        </Field>

        <FieldRow>
          <Field label="Cantidad *">
            <Input type="number" min="1" required value={form.cantidad_perfumes}
              onChange={e => setForm(f => ({ ...f, cantidad_perfumes: e.target.value }))} />
            {unidadesElegidas > 0 && Number(form.cantidad_perfumes) !== unidadesElegidas && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Arriba elegiste {unidadesElegidas} {unidadesElegidas === 1 ? 'unidad' : 'unidades'}.
              </p>
            )}
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Valor venta (COP) *">
            <Input type="number" min="0" required value={form.valor_venta}
              onChange={e => {
                // Si vuelve a teclear el valor, la sugerencia del cupón revive
                setCuponAplicado(false);
                setForm(f => ({ ...f, valor_venta: e.target.value }));
              }} />
          </Field>
          <Field label="Estado de pago">
            <NativeSelect value={form.pagada ? 'pagada' : 'pendiente'}
              onChange={e => setForm(f => ({ ...f, pagada: e.target.value === 'pagada' }))}>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente de pago</option>
            </NativeSelect>
          </Field>
        </FieldRow>

        <Field label="Código de descuento (si el pedido de WhatsApp traía uno)">
          <div className="flex gap-2">
            <Input value={form.codigo_descuento} maxLength={20} placeholder="Ej: CP-7XK2M9"
              className="uppercase"
              onChange={e => { setForm(f => ({ ...f, codigo_descuento: e.target.value })); setCodigoCheck(null); }} />
            <Button type="button" variant="outline" disabled={checking || !form.codigo_descuento.trim()} onClick={validarCodigo}>
              {checking ? 'Validando…' : 'Validar'}
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
          {/* Calculadora del cupón: hace la cuenta, pero el número lo decides tú */}
          {cupon && cuponYaEnLaVenta && (
            <p className="mt-1.5 rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2 text-[12.5px] text-primary">
              Esta venta <strong>ya tiene este cupón</strong>: los {formatPrice(valorTecleado)} guardados
              son el valor final, con el descuento ya restado. No lo vuelvas a descontar.
            </p>
          )}
          {cupon && !cuponYaEnLaVenta && noAlcanzaMinimo && (
            <p className="mt-1.5 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
              Este cupón pide una compra mínima de {formatPrice(cupon.min_monto)} y la venta va
              en {formatPrice(valorTecleado)}. Revisa antes de aplicarlo.
            </p>
          )}
          {descuentoCupon > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2">
              <p className="text-[12.5px] text-primary">
                Con este cupón, {formatPrice(valorTecleado)} quedarían en{' '}
                <strong>{formatPrice(valorTecleado - descuentoCupon)}</strong>{' '}
                (−{formatPrice(descuentoCupon)})
                {topeRecorto && <span className="text-primary/80"> — el tope de la campaña es {formatPrice(cupon!.max_descuento)}</span>}.
              </p>
              <Button type="button" size="sm" variant="outline" className="h-7" onClick={aplicarCupon}>
                Aplicar
              </Button>
            </div>
          )}
          {cuponAplicado && (
            <p className="mt-1.5 text-[12.5px] font-medium text-emerald-700">
              Descuento aplicado. El valor de la venta ya es el final.
            </p>
          )}

          <p className="mt-1 text-[12px] text-muted-foreground">
            El valor de la venta se escribe <strong>ya con el descuento restado</strong> (es la plata
            que entró de verdad). El código se canjea (deja de servir) cuando la venta queda marcada
            como pagada; si la venta se edita sin código o se elimina, vuelve a quedar activo.
          </p>
        </Field>

        <Field label="Datos adicionales">
          <Textarea rows={2} value={form.datos_adicionales} maxLength={300}
            onChange={e => setForm(f => ({ ...f, datos_adicionales: e.target.value }))} />
        </Field>
        <FormError>{error}</FormError>
      </Modal>
    </>
  );
}
