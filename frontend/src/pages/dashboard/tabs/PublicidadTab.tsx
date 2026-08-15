import { useEffect, useRef, useState } from 'react';
import { BadgePercent, CheckCircle2, ImageIcon, Megaphone, Pencil, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectSimple } from '@/components/ui/select-simple';
import Modal from '../../../components/Modal';
import ExportButton from '../../../components/ExportButton';
import ImportModal from '../../../components/ImportModal';
import { Chip } from '../../../components/catalog/FilterChips';
import { API_ANUNCIOS, fmtDate, fmtInstante, formatPrice, subirImagenAdmin, validarCodigoDescuento } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError } from '../ui';
import type { GuardedFetch, Anuncio, AnuncioForm, CodigoValidado, Lookup } from '../types';
import { emptyAnuncioForm } from '../types';

interface PublicidadTabProps {
  guardedFetch: GuardedFetch;
  categorias: Lookup[];
}

const TIPO_LABEL: Record<Anuncio['tipo'], string> = {
  imagen: 'Imagen', mensaje: 'Mensaje', descuento: 'Descuento',
};
const AUDIENCIA_LABEL: Record<Anuncio['audiencia'], string> = {
  todos: 'Todos los visitantes',
  no_registrados: 'Solo sin registrar',
  registrados: 'Solo registrados',
};

export function PublicidadTab({ guardedFetch, categorias }: PublicidadTabProps) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<AnuncioForm>(emptyAnuncioForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await guardedFetch(`${API_ANUNCIOS}/admin`);
    const json = await res.json();
    setAnuncios(json.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyAnuncioForm()); setError(''); setModal({ open: true, editId: null }); };
  const openEdit = (a: Anuncio) => {
    setForm({
      titulo: a.titulo, mensaje: a.mensaje ?? '', imagen_url: a.imagen_url ?? '',
      tipo: a.tipo, audiencia: a.audiencia,
      una_vez: a.una_vez, activo: a.activo, orden: String(a.orden),
      inicio: a.inicio ? a.inicio.slice(0, 10) : '', fin: a.fin ? a.fin.slice(0, 10) : '',
      descuento_pct: String(a.descuento_pct || 10),
      aplica_combos: a.aplica_combos, categoria_ids: a.categoria_ids,
      min_unidades: String(a.min_unidades || 0), min_monto: String(a.min_monto || 0),
      max_descuento: String(a.max_descuento || 0), max_canjes: String(a.max_canjes || 0),
    });
    setError(''); setModal({ open: true, editId: a.id });
  };

  const subirImagen = async (file: File | null) => {
    if (!file) return;
    setSubiendo(true);
    try {
      const url = await subirImagenAdmin(file);
      setForm(f => ({ ...f, imagen_url: url }));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo subir la imagen'); }
    finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const toggleCategoria = (id: number) =>
    setForm(f => ({
      ...f,
      categoria_ids: f.categoria_ids.includes(id)
        ? f.categoria_ids.filter(x => x !== id)
        : [...f.categoria_ids, id],
    }));

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    const body = {
      titulo: form.titulo.trim(),
      mensaje: form.mensaje.trim() || null,
      imagen_url: form.imagen_url.trim() || null,
      tipo: form.tipo, audiencia: form.audiencia,
      una_vez: form.una_vez, activo: form.activo,
      orden: Number(form.orden) || 0,
      inicio: form.inicio || null, fin: form.fin || null,
      descuento_pct: Number(form.descuento_pct) || 0,
      aplica_combos: form.aplica_combos,
      categoria_ids: form.categoria_ids,
      min_unidades: Number(form.min_unidades) || 0,
      min_monto: Number(form.min_monto) || 0,
      max_descuento: Number(form.max_descuento) || 0,
      max_canjes: Number(form.max_canjes) || 0,
    };
    try {
      const url = modal.editId ? `${API_ANUNCIOS}/${modal.editId}` : API_ANUNCIOS;
      const res = await guardedFetch(url, { method: modal.editId ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      setModal({ open: false, editId: null }); load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (a: Anuncio) => {
    if (!window.confirm(`¿Eliminar el anuncio "${a.titulo}"?`)) return;
    const res = await guardedFetch(`${API_ANUNCIOS}/${a.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json(); alert(j.error ?? 'Error'); return; }
    load();
  };

  // ── Certificación de códigos únicos recibidos por WhatsApp ────────────────
  const [codigoInput, setCodigoInput] = useState('');
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<CodigoValidado | null>(null);

  const validarCodigo = async () => {
    const codigo = codigoInput.trim();
    if (!codigo) return;
    setValidando(true); setResultado(null);
    setResultado(await validarCodigoDescuento(codigo));
    setValidando(false);
  };

  const cambiarEstadoCodigo = async (estado: 'activo' | 'anulado') => {
    if (!resultado) return;
    const res = await guardedFetch(`${API_ANUNCIOS}/codigos/${encodeURIComponent(resultado.codigo)}`, {
      method: 'PATCH', body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? 'Error'); return; }
    await validarCodigo(); load();
  };

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={anuncios.length}>Publicidad</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="publicidad" guardedFetch={guardedFetch} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={openCreate}>+ Nuevo anuncio</Button>
          </ToolbarActions>
        </Toolbar>

        <p className="mb-4 text-[13px] text-muted-foreground">
          Ventanas emergentes que aparecen al entrar al catálogo, en el orden definido.
          Los cupones de descuento son de un solo uso por persona y nunca se acumulan
          con otros descuentos.
        </p>

        {/* Validador: certifica si un código recibido por WhatsApp es real */}
        <div className="mb-5 rounded-2xl border border-border bg-card p-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-medium text-foreground">
            <ShieldCheck className="size-4 text-primary" /> Validar código de descuento
          </p>
          <div className="flex gap-2">
            <Input
              value={codigoInput}
              placeholder="Ej: CP-7XK2M9"
              className="min-w-0 flex-1 uppercase sm:max-w-72"
              onChange={e => setCodigoInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validarCodigo(); } }}
            />
            <Button type="button" variant="outline" className="shrink-0" disabled={validando || !codigoInput.trim()} onClick={validarCodigo}>
              {validando ? 'Validando…' : 'Validar'}
            </Button>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            El código llega en el mensaje de WhatsApp del pedido.
          </p>
          {resultado && (
            <div className={`mt-3 rounded-xl border px-3.5 py-3 text-[13px] ${
              resultado.valido
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-destructive/40 bg-destructive/5 text-destructive'
            }`}>
              <p className="flex items-center gap-1.5 font-semibold">
                {resultado.valido ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                {resultado.codigo}: {resultado.motivo}
              </p>
              {resultado.cupon && (
                <p className="mt-1 text-[12.5px] opacity-90">
                  Cupón "{resultado.cupon.titulo}" (-{resultado.cupon.descuento_pct}%) ·
                  Aplica a: {[...resultado.cupon.categorias, ...(resultado.cupon.aplica_combos ? ['Combos'] : [])].join(', ')}
                  {resultado.cupon.min_unidades > 0 && ` · Mínimo ${resultado.cupon.min_unidades} unidades`}
                  {resultado.cupon.min_monto > 0 && ` · Compra mínima ${formatPrice(resultado.cupon.min_monto)}`}
                  {resultado.cupon.max_descuento > 0 && ` · Tope ${formatPrice(resultado.cupon.max_descuento)}`}
                  <br />
                  Emitido para: {resultado.persona}{resultado.emitido && ` · ${fmtInstante(resultado.emitido)}`}
                  {resultado.venta && ` · Canjeado en la venta #${resultado.venta.id} (${resultado.venta.persona}, ${fmtDate(resultado.venta.dia)})`}
                </p>
              )}
              {resultado.estado && !resultado.venta && (
                <div className="mt-2">
                  {resultado.estado === 'activo' && (
                    <Button type="button" size="sm" variant="outline" onClick={() => cambiarEstadoCodigo('anulado')}>
                      Anular código
                    </Button>
                  )}
                  {resultado.estado === 'anulado' && (
                    <Button type="button" size="sm" variant="outline" onClick={() => cambiarEstadoCodigo('activo')}>
                      Reactivar código
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {anuncios.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Megaphone className="mx-auto mb-2 size-6 text-muted-foreground/50" />
            Aún no hay anuncios. Crea el primero con "+ Nuevo anuncio".
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {anuncios.map(a => (
            <li key={a.id} className="rounded-xl border border-border bg-card px-4 py-3">
              {/* Título a la izquierda, acciones fijas arriba a la derecha */}
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium text-foreground">
                  {a.tipo === 'descuento' ? <BadgePercent className="size-4 shrink-0 text-primary" /> :
                   a.tipo === 'imagen' ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> :
                   <Megaphone className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0">{a.titulo}</span>
                  {a.tipo === 'descuento' && (
                    <Badge className="rounded-full bg-primary text-primary-foreground">-{a.descuento_pct}%</Badge>
                  )}
                  {!a.activo && <Badge variant="secondary">Inactivo</Badge>}
                </p>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(a)} title="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(a)} title="Eliminar">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {TIPO_LABEL[a.tipo]} · {AUDIENCIA_LABEL[a.audiencia]} · {a.una_vez ? 'Una sola vez' : 'Cada visita'} · Orden {a.orden}
                {a.inicio && ` · Desde ${fmtDate(a.inicio)}`}
                {a.fin && ` · Hasta ${fmtDate(a.fin)}`}
                {a.tipo === 'descuento' && (
                  <> · Aplica a: {[...a.categorias, ...(a.aplica_combos ? ['Combos'] : [])].join(', ') || '—'}
                     {a.min_unidades > 0 && ` · Mínimo ${a.min_unidades} unidades`}
                     {a.min_monto > 0 && ` · Compra mínima ${formatPrice(a.min_monto)}`}
                     {a.max_descuento > 0 && ` · Tope ${formatPrice(a.max_descuento)}`}</>
                )}
              </p>
              {a.tipo === 'descuento' && (
                <p className="mt-1 text-[12px] font-medium text-primary">
                  🎟 {a.codigos_activos} por canjear · {a.codigos_canjeados} canjeados
                  {a.max_canjes > 0 && ` · cupo ${a.codigos_activos + a.codigos_canjeados}/${a.max_canjes}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="publicidad"
        guardedFetch={guardedFetch}
        onImported={load}
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, editId: null })}
        title={modal.editId ? 'Editar anuncio' : 'Nuevo anuncio'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : 'Guardar'}
        loading={loading}
      >
        <FieldRow>
          <Field label="Tipo *">
            <SelectSimple value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as AnuncioForm['tipo'] }))}>
              <option value="mensaje">Mensaje / información</option>
              <option value="imagen">Solo imagen</option>
              <option value="descuento">Cupón de descuento</option>
            </SelectSimple>
          </Field>
          <Field label="Audiencia *">
            <SelectSimple value={form.audiencia}
              onChange={e => setForm(f => ({ ...f, audiencia: e.target.value as AnuncioForm['audiencia'] }))}>
              <option value="todos">Todos los visitantes</option>
              <option value="no_registrados">Solo quienes NO se han registrado</option>
              <option value="registrados">Solo cuentas registradas</option>
            </SelectSimple>
          </Field>
        </FieldRow>

        <Field label="Título *">
          <Input required maxLength={150} value={form.titulo}
            placeholder="Ej: ¡10% de descuento por registrarte!"
            onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </Field>

        {form.tipo !== 'imagen' && (
          <Field label="Mensaje">
            <Textarea rows={3} maxLength={2000} value={form.mensaje}
              placeholder="Texto que verá el visitante en la ventana"
              onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))} />
          </Field>
        )}

        <Field label={form.tipo === 'imagen' ? 'Imagen *' : 'Imagen (opcional)'}>
          <div className="flex gap-2">
            <Input value={form.imagen_url} placeholder="https://... o sube un archivo"
              onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => subirImagen(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" disabled={subiendo} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> {subiendo ? 'Subiendo…' : 'Subir'}
            </Button>
          </div>
          {form.imagen_url && (
            <img src={form.imagen_url} alt="Vista previa" className="mt-2 max-h-36 rounded-xl border border-border object-contain" />
          )}
        </Field>

        {form.tipo === 'descuento' && (
          <div className="space-y-3 rounded-xl border border-primary/25 bg-brand-soft/40 p-3.5">
            <Field label="Porcentaje de descuento *">
              <Input type="number" min="1" max="100" value={form.descuento_pct}
                onChange={e => setForm(f => ({ ...f, descuento_pct: e.target.value }))} />
            </Field>
            <Field label="Aplica a estas categorías">
              <div className="flex flex-wrap gap-1.5">
                {categorias.map(c => (
                  <Chip key={c.id} active={form.categoria_ids.includes(c.id)} onClick={() => toggleCategoria(c.id)}>
                    {c.nombre}
                  </Chip>
                ))}
                <Chip active={form.aplica_combos} onClick={() => setForm(f => ({ ...f, aplica_combos: !f.aplica_combos }))}>
                  Combos
                </Chip>
              </div>
            </Field>
            <FieldRow>
              <Field label="Unidades mínimas (0 = sin mínimo)">
                <Input type="number" min="0" max="999" value={form.min_unidades}
                  onChange={e => setForm(f => ({ ...f, min_unidades: e.target.value }))} />
              </Field>
              <Field label="Compra mínima COP (0 = sin mínimo)">
                <Input type="number" min="0" value={form.min_monto}
                  onChange={e => setForm(f => ({ ...f, min_monto: e.target.value }))} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Tope del descuento COP (0 = sin tope)">
                <Input type="number" min="0" value={form.max_descuento}
                  onChange={e => setForm(f => ({ ...f, max_descuento: e.target.value }))} />
              </Field>
              <Field label="Cupo total de canjes (0 = ilimitado)">
                <Input type="number" min="0" max="9999" value={form.max_canjes}
                  onChange={e => setForm(f => ({ ...f, max_canjes: e.target.value }))} />
              </Field>
            </FieldRow>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Los mínimos se cuentan sobre los productos del carrito que el cupón cubre.
              El cupón es de <strong>un solo uso por persona</strong> (al enviar el pedido
              se emite un código único que llega en el mensaje de WhatsApp) y cada persona
              sostiene <strong>un solo cupón a la vez</strong>. El tope limita el descuento
              en pesos por canje y el cupo cierra la campaña al agotarse los códigos.
            </p>
          </div>
        )}

        <FieldRow>
          <Field label="Se muestra">
            <SelectSimple value={form.una_vez ? 'una' : 'siempre'}
              onChange={e => setForm(f => ({ ...f, una_vez: e.target.value === 'una' }))}>
              <option value="una">Una sola vez por persona</option>
              <option value="siempre">En cada visita</option>
            </SelectSimple>
          </Field>
          <Field label="Estado">
            <SelectSimple value={form.activo ? 'on' : 'off'}
              onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'on' }))}>
              <option value="on">Activo</option>
              <option value="off">Inactivo</option>
            </SelectSimple>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Orden de aparición">
            <Input type="number" min="0" value={form.orden}
              onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} />
          </Field>
          <Field label="Vigencia (opcional)">
            {/* En celular los dos calendarios no caben en una fila: se apilan */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input type="date" className="min-w-0" value={form.inicio}
                onChange={e => setForm(f => ({ ...f, inicio: e.target.value }))} />
              <span className="hidden text-[12px] text-muted-foreground sm:inline">a</span>
              <Input type="date" className="min-w-0" value={form.fin}
                onChange={e => setForm(f => ({ ...f, fin: e.target.value }))} />
            </div>
          </Field>
        </FieldRow>

        <FormError>{error}</FormError>
      </Modal>
    </>
  );
}
