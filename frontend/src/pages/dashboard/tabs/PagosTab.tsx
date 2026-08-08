import { useEffect, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../components/Modal';
import DetalleCompra, { type LineaCompra } from '../compras/DetalleCompra';
import { BASE_URL } from '../../../infrastructure/api/client';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { IvaDeLaCompra } from '../compras/IvaDeLaCompra';
import { IVA_MODOS } from '../compras/iva';
import { pagosColumns } from '../columns';
import { API_PAGOS, API_EMPRESAS, DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
import { EncabezadoPagina, FranjaMetricas, Section, Field, FieldRow, FormError, StatCard } from '../ui';
import type { GuardedFetch, Pago, Empresa, PagoForm, IvaModo } from '../types';
import type { Insumo } from '../../../domain/entities/cotizacion.types';
import { emptyPagoForm } from '../types';

interface PagosTabProps {
  guardedFetch: GuardedFetch;
}

export function PagosTab({ guardedFetch }: PagosTabProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totales, setTotales] = useState<{ total_compras: number; total_envios: number } | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  // Detalle de la compra: mueve el inventario y el costo promedio
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lineas, setLineas] = useState<LineaCompra[]>([]);
  // null = se usa el modo del proveedor; con valor, esta factura lo corrige
  const [ivaModo, setIvaModo] = useState<IvaModo | null>(null);
  const [ivaTasa, setIvaTasa] = useState(0.19);
  const [archivos, setArchivos] = useState<string[]>([]);
  const [form, setForm] = useState<PagoForm>(emptyPagoForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const cargarInsumos = async () => {
    const r = await guardedFetch(`${BASE_URL}/api/costeo/insumos`);
    if (r.ok) setInsumos((await r.json()).data ?? []);
  };

  /**
   * Tasa de IVA vigente. Viene del servidor, no de una constante: cambia por ley.
   * Si la petición falla se queda en 0.19, que es la general de Colombia — es
   * mejor mostrar la cuenta con la tasa habitual que no mostrarla.
   */
  const cargarConfigIva = async () => {
    try {
      const r = await guardedFetch(`${API_PAGOS}/config-iva`);
      if (r.ok) setIvaTasa((await r.json()).data?.iva_tasa ?? 0.19);
    } catch { /* se queda el valor por defecto */ }
  };

  const load = async (p = page, s = pageSize, term = searchTerm) => {
    const searchQs = term ? `&search=${encodeURIComponent(term)}` : '';
    const [pRes, tRes, eRes] = await Promise.all([
      guardedFetch(`${API_PAGOS}?page=${p}&limit=${s}${searchQs}`),
      guardedFetch(`${API_PAGOS}/totales`),
      guardedFetch(API_EMPRESAS),
    ]);
    const [pJson, tJson, eJson] = await Promise.all([pRes.json(), tRes.json(), eRes.json()]);
    setPagos(pJson.data ?? []);
    setTotal(pJson.total ?? 0);
    setPage(p);
    setTotales(tJson.data ?? null);
    setEmpresas(eJson.data ?? []);
  };

  useEffect(() => { load(1); cargarInsumos(); cargarConfigIva(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Se llega aquí desde el botón "Registrar llegada" de Inventario
  // (/dashboard/pagos?nueva=1): abre el formulario de una vez, sin pedirle al
  // dueño que adivine que "registrar lo que llegó" vive bajo "Proveedores".
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('nueva') === '1') {
      openCreate();
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setForm(emptyPagoForm()); setError(''); setLineas([]); setArchivos([]);
    setModal({ open: true, editId: null });
  }
  const openEdit = (p: Pago) => {
    setForm({
      dia: p.dia.slice(0, 10), empresa_id: p.empresa.id,
      nueva_nombre: '', nueva_nit: '', nueva_telefono: '', nueva_correo: '', nueva_direccion: '',
      nueva_iva_modo: 'incluido' as IvaModo,
      valor_compra: String(p.valor_compra), coste_envio: String(p.coste_envio),
      detalles_adicionales: p.detalles_adicionales ?? '',
      numero_factura: p.numero_factura ?? '',
    });
    setIvaModo(p.iva_modo ?? null);
    setLineas((p.items ?? []).map(i => ({
      insumo_id: i.insumo_id, insumo_nombre: i.insumo_nombre,
      cantidad: String(i.cantidad), unidad_compra: i.unidad_compra, subtotal: String(i.subtotal),
    })));
    setArchivos(p.archivos ?? []);
    setError(''); setModal({ open: true, editId: p.id });
  };
  const closeModal = () => setModal({ open: false, editId: null });

  // Modo de IVA de ESTA factura. null = se usa el del proveedor.
  const empresaElegida = empresas.find(e => e.id === form.empresa_id) ?? null;
  const modoProveedor: IvaModo = empresaElegida?.iva_modo ?? 'incluido';
  const modoEfectivo: IvaModo = ivaModo ?? modoProveedor;

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    let empresaId: number | '' = form.empresa_id === 'nuevo' ? '' : (form.empresa_id as number | '');

    if (form.empresa_id === 'nuevo') {
      if (!form.nueva_nombre.trim()) { setError('El nombre de la empresa es obligatorio'); setLoading(false); return; }
      try {
        const res = await guardedFetch(API_EMPRESAS, {
          method: 'POST',
          body: JSON.stringify({
            nombre: form.nueva_nombre.trim(), nit: form.nueva_nit.trim() || null,
            telefono: form.nueva_telefono.trim() || null, correo: form.nueva_correo.trim() || null,
            direccion: form.nueva_direccion.trim() || null,
            iva_modo: form.nueva_iva_modo,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Error al crear empresa'); setLoading(false); return; }
        empresaId = json.data.id;
      } catch { setError('No se pudo crear la empresa'); setLoading(false); return; }
    }

    if (!empresaId) { setError('Selecciona o crea una empresa'); setLoading(false); return; }

    try {
      const body = {
        dia: form.dia, empresa_id: empresaId,
        valor_compra: Number(form.valor_compra), coste_envio: Number(form.coste_envio),
        detalles_adicionales: form.detalles_adicionales.trim() || null,
        numero_factura: form.numero_factura.trim() || null,
        archivos,
        // Solo viaja si se corrigio: si no, manda el del proveedor
        ...(ivaModo && ivaModo !== modoProveedor ? { iva_modo: ivaModo } : {}),
        // Solo viajan las líneas completas: una a medias descuadraría el costo
        items: lineas
          .filter(l => Number(l.cantidad) > 0 && Number(l.subtotal) >= 0 && l.subtotal !== '')
          .map(l => ({
            insumo_id: l.insumo_id, cantidad: Number(l.cantidad),
            unidad_compra: l.unidad_compra, subtotal: Number(l.subtotal),
          })),
      };
      const url = modal.editId ? `${API_PAGOS}/${modal.editId}` : API_PAGOS;
      const method = modal.editId ? 'PATCH' : 'POST';
      const res = await guardedFetch(url, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      closeModal(); load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (p: Pago) => {
    if (!window.confirm(`¿Eliminar el pago a ${p.empresa.nombre}? Si tenia lineas de compra, el inventario que entro con ellas se revierte.`)) return;
    try {
      const res = await guardedFetch(`${API_PAGOS}/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error ?? 'No se pudo eliminar', { id: 'pagos' });
        return;
      }
      load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'pagos' }); }
  };

  const acciones = (p: Pago, conTexto: boolean) => (
    <>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
        onClick={() => openEdit(p)}
        title="Editar"
      >
        <Pencil className="size-4" />{conTexto && ' Editar'}
      </Button>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? 'text-destructive' : 'size-8 text-muted-foreground hover:text-destructive'}
        onClick={() => handleDelete(p)}
        title="Eliminar"
      >
        <Trash2 className="size-4" />{conTexto && ' Borrar'}
      </Button>
    </>
  );

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Proveedores" count={total} />

      {totales && (
        <FranjaMetricas>
          <StatCard label="Total en compras" value={formatPrice(totales.total_compras)}
            nota="Lo pagado por material, sin el transporte" />
          <StatCard label="Total en envios" value={formatPrice(totales.total_envios)}
            nota="El flete tambien es parte de lo que costo el material" />
          <StatCard label="Total general" value={formatPrice(totales.total_compras + totales.total_envios)}
            nota="Todo lo que le has pagado a tus proveedores" />
        </FranjaMetricas>
      )}

      <Section>
        <SmartTable
          columns={pagosColumns}
          rows={pagos}
          rowKey={p => p.id}
          numerada
          tarjetaMovil
          onServerSearch={t => { setSearchTerm(t); load(1, pageSize, t); }}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => load(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); load(1, s); },
          }}
          renderActions={p => acciones(p, false)}
          accionesMovil={p => acciones(p, true)}
          acciones={
            <>
              <ExportButton entity="proveedores" guardedFetch={guardedFetch} />
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" /> Importar
              </Button>
              <Button size="sm" onClick={openCreate}>+ Registrar pago</Button>
            </>
          }
        />
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="proveedores"
        guardedFetch={guardedFetch}
        onImported={() => load(1)}
      />

      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.editId ? 'Editar pago' : 'Registrar pago a proveedor'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : modal.editId ? 'Guardar cambios' : 'Registrar'}
        loading={loading}
      >
        <FieldRow>
          <Field label="Dia *">
            <Input type="date" required value={form.dia}
              onChange={e => setForm(f => ({ ...f, dia: e.target.value }))} />
          </Field>
          <Field label="Valor compra (COP) *">
            <Input type="number" min="0" required value={form.valor_compra}
              onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))} />
          </Field>
        </FieldRow>
        <Field label="Empresa *">
          <BuscadorSelect
            value={String(form.empresa_id)}
            placeholder="— Selecciona una empresa —"
            opciones={[
              { id: '', nombre: '— Selecciona una empresa —' },
              ...(!modal.editId ? [{ id: 'nuevo', nombre: '+ Registrar empresa nueva' }] : []),
              ...empresas.map(em => ({ id: em.id, nombre: `${em.nombre}${em.nit ? ` · NIT: ${em.nit}` : ''}` })),
            ]}
            onSelect={id => {
              const val = String(id);
              setForm(f => ({ ...f, empresa_id: val === '' ? '' : val === 'nuevo' ? 'nuevo' : Number(val) }));
            }}
          />
        </Field>
        {form.empresa_id === 'nuevo' && (
          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3.5">
            <FieldRow>
              <Field label="Nombre empresa *">
                <Input value={form.nueva_nombre} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nueva_nombre: e.target.value }))} />
              </Field>
              <Field label="NIT">
                <Input value={form.nueva_nit} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nueva_nit: e.target.value }))} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Telefono">
                <Input value={form.nueva_telefono} maxLength={20}
                  onChange={e => setForm(f => ({ ...f, nueva_telefono: e.target.value }))} />
              </Field>
              <Field label="Correo">
                <Input type="email" value={form.nueva_correo} maxLength={100}
                  onChange={e => setForm(f => ({ ...f, nueva_correo: e.target.value }))} />
              </Field>
            </FieldRow>
            <Field label="Direccion">
              <Input value={form.nueva_direccion} maxLength={150}
                onChange={e => setForm(f => ({ ...f, nueva_direccion: e.target.value }))} />
            </Field>
            <Field label="Como te factura el IVA">
              <NativeSelect value={form.nueva_iva_modo}
                onChange={e => setForm(f => ({ ...f, nueva_iva_modo: e.target.value as IvaModo }))}>
                {IVA_MODOS.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
              </NativeSelect>
            </Field>
          </div>
        )}
        <FieldRow>
          <Field label="Costo de envio (COP)">
            <Input type="number" min="0" value={form.coste_envio}
              onChange={e => setForm(f => ({ ...f, coste_envio: e.target.value }))} />
          </Field>
        </FieldRow>
        {/* La cuenta a la vista: verla antes de guardar es lo que evita el error */}
        <IvaDeLaCompra
          valor={Number(form.valor_compra) || 0}
          modo={modoEfectivo}
          tasa={ivaTasa}
          modoDelProveedor={modoProveedor}
          onModo={setIvaModo}
        />
        <Field label="Numero de factura o remision">
          <Input value={form.numero_factura} maxLength={60} placeholder="Ej: FV-8891"
            onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} />
        </Field>

        <DetalleCompra
          guardedFetch={guardedFetch}
          insumos={insumos}
          lineas={lineas}
          onLineas={setLineas}
          archivos={archivos}
          onArchivos={setArchivos}
          flete={Number(form.coste_envio) || 0}
          onInsumoCreado={i => setInsumos(prev => [...prev, i])}
        />

        <Field label="Detalles adicionales">
          <Textarea rows={2} value={form.detalles_adicionales} maxLength={300}
            onChange={e => setForm(f => ({ ...f, detalles_adicionales: e.target.value }))} />
        </Field>
        <FormError>{error}</FormError>
      </Modal>
    </div>
  );
}
