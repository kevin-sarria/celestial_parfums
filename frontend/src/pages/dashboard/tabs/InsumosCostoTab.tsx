import { useEffect, useState } from 'react';
import { Info, Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Modal from '../../../components/Modal';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { BASE_URL } from '../../../infrastructure/api/client';
import { formatPrice } from '../helpers';
import { EncabezadoPagina, Section, Field, FieldRow } from '../ui';
import type { GuardedFetch } from '../types';
import type { Insumo, InsumoAlcance, InsumoTipo, InsumoUnidad } from '../../../domain/entities/cotizacion.types';

const API = `${BASE_URL}/api/costeo`;

const GRUPOS: { tipo: InsumoTipo; titulo: string; ayuda: string }[] = [
  { tipo: 'materia_prima', titulo: 'Materias primas', ayuda: 'Se cobran por mililitro (esencia, diluyente, sellador, feromonas).' },
  { tipo: 'envase', titulo: 'Envases', ayuda: 'El frasco de cada tamaño. Se asigna a un tamaño en "Tamaños y fórmulas".' },
  { tipo: 'accesorio', titulo: 'Accesorios', ayuda: 'Bolsa de organza, perfumero, caja, etiquetas… Se eligen por producto al cotizar.' },
];

const vacio = { nombre: '', tipo: 'materia_prima' as InsumoTipo, unidad: 'ml' as InsumoUnidad, alcance: 'unidad' as InsumoAlcance, precio: '' };

/**
 * Costos de producción: el admin teclea cuánto le cuesta cada insumo hoy.
 * Es la base del cálculo de rentabilidad de las cotizaciones mayoristas.
 */
export function InsumosCostoTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [items, setItems] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [form, setForm] = useState(vacio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // try/finally: un fallo de red o un 429 no debe dejar la vista cargando eterno.
  const [errorCarga, setErrorCarga] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      // `todos=1`: esta es la pantalla que los administra, así que también ve
      // los apagados — si no, no habría forma de volver a encenderlos.
      const res = await guardedFetch(`${API}/insumos?todos=1`);
      if (!res.ok) throw new Error('respuesta no válida');
      setItems((await res.json()).data ?? []);
      setErrorCarga('');
    } catch {
      setErrorCarga('No se pudieron cargar los insumos. Revisa tu conexión y reintenta.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirNuevo = (tipo: InsumoTipo) => {
    setForm({ ...vacio, tipo, unidad: tipo === 'materia_prima' ? 'ml' : 'unidad' });
    setError(''); setModal({ open: true, id: null });
  };

  const abrirEditar = (i: Insumo) => {
    setForm({ nombre: i.nombre, tipo: i.tipo, unidad: i.unidad, alcance: i.alcance ?? 'unidad', precio: String(i.precio) });
    setError(''); setModal({ open: true, id: i.id });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('Ponle un nombre'); return; }
    const precio = Number(form.precio);
    if (isNaN(precio) || precio < 0) { setError('El precio debe ser un número válido'); return; }
    setSaving(true); setError('');
    try {
      const url = modal.id ? `${API}/insumos/${modal.id}` : `${API}/insumos`;
      const res = await guardedFetch(url, {
        method: modal.id ? 'PATCH' : 'POST',
        body: JSON.stringify({ nombre: form.nombre.trim(), tipo: form.tipo, unidad: form.unidad, alcance: form.alcance, precio }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error ?? 'No se pudo guardar'); return; }
      setModal({ open: false, id: null }); load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setSaving(false); }
  };

  const eliminar = async (i: Insumo) => {
    if (!window.confirm(
      `¿Eliminar "${i.nombre}"?\n\n`
      + 'Solo se puede si nunca se usó. Si ya tiene compras o movimientos, el sistema '
      + 'te lo dirá: en ese caso apágalo en vez de borrarlo.',
    )) return;
    try {
      const res = await guardedFetch(`${API}/insumos/${i.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        // El servidor dice QUÉ lo retiene y qué hacer; un texto genérico dejaría
        // al dueño adivinando entre cinco causas posibles.
        toast.error(j?.error ?? 'No se pudo eliminar', { id: 'insumos', duration: 9000 });
        return;
      }
      toast.success(`"${i.nombre}" eliminado`);
      load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'insumos' }); }
  };

  /**
   * Apagar un insumo lo esconde de los buscadores de compras y producción, y de
   * la pantalla de Inventario, SIN tocar su historial. Es lo que hay que usar
   * para jubilar un material que ya tiene movimientos: borrarlo dejaría esos
   * registros sin referencia.
   */
  const alternarActivo = async (i: Insumo) => {
    const activo = !(i.activo ?? true);
    try {
      const res = await guardedFetch(`${API}/insumos/${i.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: i.nombre, tipo: i.tipo, unidad: i.unidad,
          alcance: i.alcance ?? 'unidad', precio: i.precio, activo,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { toast.error(j?.error ?? 'No se pudo cambiar', { id: 'insumos' }); return; }
      toast.success(activo
        ? `"${i.nombre}" vuelve a estar disponible`
        : `"${i.nombre}" apagado: ya no aparecerá al comprar ni producir`);
      load();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'insumos' }); }
  };

  if (loading) return <Section><PerfumeSpinner /></Section>;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Insumos y precios" count={items.length} />

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Aquí registras <strong>cuánto te cuesta hoy</strong> cada cosa. Con estos números el
          sistema calcula solo la ganancia de cada cotización mayorista. Esta información es
          interna: <strong>nunca</strong> aparece en la cotización que ve el cliente.
        </span>
      </p>

      {errorCarga && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {errorCarga}
          <Button size="sm" variant="outline" className="h-7" onClick={() => load()}>Reintentar</Button>
        </p>
      )}

      <Section className="flex flex-col gap-8">
        {GRUPOS.map(({ tipo, titulo, ayuda }) => {
          const delGrupo = items.filter((i) => i.tipo === tipo);
          return (
            <div key={tipo}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="font-display text-[17px] font-medium text-foreground">{titulo}</h3>
                <Button variant="outline" size="sm" onClick={() => abrirNuevo(tipo)}>
                  <Plus className="size-4" /> Agregar
                </Button>
              </div>
              <p className="mb-3 text-[12.5px] text-muted-foreground">{ayuda}</p>

              {delGrupo.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">
                  Nada registrado todavía.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {delGrupo.map((i) => {
                    const activo = i.activo ?? true;
                    return (
                    <li key={i.id}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                        activo ? 'border-border bg-card' : 'border-dashed border-border bg-secondary/40'
                      }`}>
                      <span className={`min-w-0 flex-1 truncate text-[14px] font-medium ${
                        activo ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {i.nombre}
                        {!activo && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                            apagado
                          </span>
                        )}
                      </span>
                      <span className={`whitespace-nowrap text-[13.5px] tabular-nums ${
                        activo ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {formatPrice(i.precio)}
                        <span className="ml-1 text-[11.5px] text-muted-foreground">/{i.unidad === 'ml' ? 'ml' : 'u'}</span>
                      </span>
                      {/* Apagar es lo que se usa para jubilar un material con
                          historial; borrar solo sirve si nunca se usó. */}
                      <Button size="sm" variant="ghost" className="h-8 text-[12.5px]"
                        title={activo
                          ? 'Dejará de aparecer al comprar y producir. Su historial queda intacto.'
                          : 'Vuelve a estar disponible al comprar y producir.'}
                        onClick={() => alternarActivo(i)}>
                        {activo ? <ToggleRight className="size-4 text-primary" /> : <ToggleLeft className="size-4" />}
                        {activo ? 'Apagar' : 'Encender'}
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEditar(i)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => eliminar(i)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </Section>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, id: null })}
        title={modal.id ? 'Editar insumo' : 'Nuevo insumo'}
        maxWidth={460}
        footer={
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setModal({ open: false, id: null })}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">
            <Input value={form.nombre} maxLength={120} placeholder="Ej: Esencia, Envase 30 ml, Bolsa de organza"
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </Field>
          <FieldRow>
            <Field label="Tipo">
              <NativeSelect value={form.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as InsumoTipo;
                  setForm((f) => ({ ...f, tipo, unidad: tipo === 'materia_prima' ? 'ml' : 'unidad' }));
                }}>
                <option value="materia_prima">Materia prima</option>
                <option value="envase">Envase</option>
                <option value="accesorio">Accesorio</option>
              </NativeSelect>
            </Field>
            <Field label="Se cobra por">
              <NativeSelect value={form.unidad}
                onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value as InsumoUnidad }))}>
                <option value="ml">Mililitro (ml)</option>
                <option value="unidad">Unidad / pieza</option>
              </NativeSelect>
            </Field>
          </FieldRow>
          <Field label={form.unidad === 'ml' ? 'Costo por ml' : 'Costo por unidad'}>
            <Input type="number" min="0" step="0.01" value={form.precio} placeholder="0"
              onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} />
          </Field>
          {/* Solo aplica a accesorios: una caja de envío va 1 vez por pedido,
              una bolsa va 1 por cada perfume. */}
          {form.tipo === 'accesorio' && (
            <Field label="¿Se cobra por…?">
              <NativeSelect value={form.alcance}
                onChange={(e) => setForm((f) => ({ ...f, alcance: e.target.value as InsumoAlcance }))}>
                <option value="unidad">Cada perfume (bolsa, perfumero, tarjeta…)</option>
                <option value="pedido">Todo el pedido (caja de envío, papel burbuja…)</option>
              </NativeSelect>
            </Field>
          )}
          {error && <p className="text-[12.5px] font-medium text-destructive">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
