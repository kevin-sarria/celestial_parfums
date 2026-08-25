import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectSimple } from '@/components/ui/select-simple';
import { cn } from '@/lib/utils';
import Modal from '../../../../components/Modal';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { formatPrice } from '../../helpers';
import { Field, FieldRow, FormError } from '../../ui';
import type { Lookup, PerfumeForm } from '../../types';
import { CheckGroup } from './CheckGroup';
import { SelectorTipoProducto } from './SelectorTipoProducto';
import { CAMPOS_POR_TIPO, TIPOS_ALTA, tipoDeForm, valoresDeTipo } from './tipoDeProducto';
import { TallasDelPerfume } from './TallasDelPerfume';
import type { FichaPerfume } from './useFichaPerfume';

interface FichaPerfumeModalProps {
  ficha: FichaPerfume;
  aromas: Lookup[];
  ocasiones: Lookup[];
  categorias: Lookup[];
  presentaciones: Lookup[];
  /** Texto del título y del botón: "perfume" en Perfumes, "producto" en Productos. */
  sustantivo: 'perfume' | 'producto';
}

const toggleId = (ids: number[], id: number) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];

/**
 * El formulario entero de un perfume: crear y editar.
 *
 * Salió de `PerfumesTab.tsx` (iba en 468 líneas) para que la pestaña de
 * Productos muestre la MISMA ficha en vez de copiarla. Lo único que cambia
 * entre las dos pestañas es cómo se llama la cosa que se está creando, y eso
 * viaja en `sustantivo`. Todo el estado vive en `useFichaPerfume`.
 */
export function FichaPerfumeModal({
  ficha, aromas, ocasiones, categorias, presentaciones, sustantivo,
}: FichaPerfumeModalProps) {
  const { form, setForm } = ficha;
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Al crear se empieza por elegir qué es; al editar no, porque la ficha ya lo
   * dice y volver a preguntarlo sería un clic de más en la tarea que más se
   * repite.
   */
  const tipo = tipoDeForm(form);
  const campos = CAMPOS_POR_TIPO[tipo];
  const eligiendo = !ficha.modal.editId && !ficha.tipoElegido;
  const setF = (field: keyof PerfumeForm) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <Modal
      open={ficha.modal.open}
      onClose={ficha.cerrar}
      title={ficha.modal.editId ? `Editar ${sustantivo}` : `Nuevo ${sustantivo}`}
      onSubmit={ficha.guardar}
      submitLabel={ficha.formLoading ? 'Guardando...' : ficha.modal.editId ? 'Guardar cambios' : `Crear ${sustantivo}`}
      loading={ficha.formLoading}
      maxWidth={620}
      // Sin tipo elegido todavía no hay nada que guardar: el botón sobra.
      ocultarSubmit={eligiendo}
    >
      {eligiendo ? (
        <SelectorTipoProducto onElegir={(t) => {
          setForm(f => ({ ...f, ...valoresDeTipo(t) }));
          ficha.setTipoElegido(t);
        }} />
      ) : (
      <>
      {/* Qué se está creando, siempre visible y siempre cambiable. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <span className="text-[13px] text-foreground">
          {TIPOS_ALTA.find(t => t.id === tipo)?.emoji}{' '}
          <strong>{TIPOS_ALTA.find(t => t.id === tipo)?.titulo}</strong>
        </span>
        {!ficha.modal.editId && (
          <button type="button" className="text-[12.5px] font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => ficha.setTipoElegido(null)}>
            Cambiar
          </button>
        )}
      </div>

      <FieldRow>
        <Field label="Nombre *">
          <Input value={form.nombre} onChange={setF('nombre')} required maxLength={100} />
        </Field>
        <Field label="Precio de respaldo (COP) *">
          <Input type="number" min="0" value={form.precio} onChange={setF('precio')} required />
          <p className="mt-1 text-[12px] text-muted-foreground">
            Solo se usa si la talla no tiene precio abajo ni en la lista.
          </p>
        </Field>
      </FieldRow>
      <Field label="Descripción">
        <Textarea value={form.descripcion} onChange={setF('descripcion')} rows={2} maxLength={500} />
      </Field>
      {campos.atributosDeFragancia && (
      <FieldRow>
        <Field label="Duración">
          <Input placeholder="ej: 6-8 horas" value={form.duracion} onChange={setF('duracion')} maxLength={50} />
        </Field>
        <Field label="Proyección">
          <Input placeholder="ej: Moderada" value={form.proyeccion} onChange={setF('proyeccion')} maxLength={50} />
        </Field>
      </FieldRow>
      )}
      <FieldRow>
        {campos.atributosDeFragancia && (
        <Field label="Género">
          <SelectSimple value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value as PerfumeForm['genero'] }))}>
            <option value="">— Sin especificar —</option>
            <option value="dama">Dama</option>
            <option value="caballero">Caballero</option>
            <option value="unisex">Unisex</option>
          </SelectSimple>
        </Field>
        )}
        <Field label="Categoría">
          <SelectSimple value={form.categoria_id}
            onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value === '' ? '' : Number(e.target.value) }))}>
            <option value="">— Sin especificar —</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </SelectSimple>
        </Field>
      </FieldRow>

      <Field label="Imagen">
        <div className="mb-2 inline-flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', ficha.imgMode === 'url' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => ficha.setImgMode('url')}
          >
            URL
          </button>
          <button
            type="button"
            className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', ficha.imgMode === 'file' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => { ficha.setImgMode('file'); fileInputRef.current?.click(); }}
          >
            Subir archivo
          </button>
        </div>
        {ficha.imgMode === 'url' ? (
          <Input placeholder="https://..." value={form.imagen_url} onChange={setF('imagen_url')} maxLength={500} />
        ) : (
          <div
            className="flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            {ficha.uploading ? 'Subiendo...' : form.imagen_url
              ? <><img src={form.imagen_url} alt="preview" className="h-16 rounded-lg object-cover" /> <span>Cambiar</span></>
              : '📁 Haz clic para seleccionar una imagen'}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={ficha.subirImagen} />
        {form.imagen_url && ficha.imgMode === 'url' && (
          <img src={form.imagen_url} alt="preview" className="mt-2 h-20 rounded-lg border border-border object-cover" />
        )}
      </Field>

      {campos.atributosDeFragancia && (
      <FieldRow>
        <Field label="Tipos de aroma">
          <CheckGroup items={aromas} selected={form.tipos_aroma}
            onToggle={id => setForm(f => ({ ...f, tipos_aroma: toggleId(f.tipos_aroma, id) }))} />
        </Field>
        <Field label="Ocasiones">
          <CheckGroup items={ocasiones} selected={form.ocasiones}
            onToggle={id => setForm(f => ({ ...f, ocasiones: toggleId(f.ocasiones, id) }))} />
        </Field>
      </FieldRow>
      )}

      {campos.tallas && (
        <TallasDelPerfume
          form={form}
          setForm={setForm}
          presentaciones={presentaciones}
          envases={ficha.envases}
          precioDeLista={ficha.precioDeLista}
        />
      )}

      {/* Un 1.1 puede prepararlo el dueño con su esencia o comprarlo ya hecho.
          Los dos son 1.1 —envase premium, precio propio y solo se venden si hay
          unidades—; lo único que cambia es de dónde sale su costo. */}
      {campos.preparadoOComprado && (
        <Field label="¿Este 1.1 lo preparas tú o lo compras hecho?">
          <SelectSimple value={form.tipo_producto}
            onChange={e => setForm(f => ({ ...f, tipo_producto: e.target.value as PerfumeForm['tipo_producto'] }))}>
            <option value="fabricado">Lo preparo yo (gasta mi esencia)</option>
            <option value="comprado">Lo compro ya hecho</option>
          </SelectSimple>
          <p className="mt-1 text-[12px] text-muted-foreground">
            En los dos casos se vende solo si tienes frascos armados. Cambia de dónde sale su costo.
          </p>
        </Field>
      )}

      {(campos.insumoOrigen || campos.accesorio) && (
        <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
          {/* Solo en "comprado": un accesorio se compra hecho y se revende, no
              tiene receta ni talla. Mostrarla también en "fraccionado" dejaría
              marcar algo que el servidor rechaza al guardar. */}
          {campos.accesorio && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card p-2.5 text-[13px] text-foreground">
              <input
                type="checkbox" className="mt-0.5 size-4 accent-primary"
                checked={form.es_accesorio}
                onChange={e => setForm(f => ({ ...f, es_accesorio: e.target.checked }))}
              />
              <span>
                Es un accesorio, no una fragancia (perfumero, bolsa, tarjeta…)
                <span className="block text-[12px] font-normal text-muted-foreground">
                  Aparece en su propio buscador dentro de Registrar venta, aparte de los
                  perfumes, para agregarlo como extra o como regalo en cualquier venta.
                </span>
              </span>
            </label>
          )}

          <Field label={tipo === 'decant' ? '¿De qué botella sale?' : '¿Qué insumo ES este producto?'}>
            <BuscadorSelect
              value={form.insumo_producto_id}
              placeholder="— Elige el insumo —"
              opciones={[
                { id: '', nombre: '— Sin asignar —' },
                ...ficha.insumosProducto.map(i => ({ id: i.id, nombre: `${i.nombre} · ${formatPrice(i.precio)}` })),
              ]}
              onSelect={id => setForm(f => ({ ...f, insumo_producto_id: id === '' ? '' : Number(id) }))}
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              Ahí vive su stock y su costo real. Créalo primero en Insumos y precios.
            </p>
          </Field>

          {campos.mlUtiles && (
            <Field label="¿Cuántos ml aprovechas de la botella?">
              <Input type="number" min="1" value={form.ml_utiles} placeholder="Ej: 95 de una de 100"
                onChange={e => setForm(f => ({ ...f, ml_utiles: e.target.value }))} />
              <p className="mt-1 text-[12px] text-muted-foreground">
                Menos que el volumen nominal: al trasvasar siempre queda producto en el frasco
                y en la jeringa. Si pones el nominal, cada decant te saldrá más barato de lo real.
              </p>
            </Field>
          )}
        </div>
      )}

      {/* Esencia concreta: cada fragancia tiene su propio costo por ml. Un 1.1
          comprado hecho no gasta esencia del negocio, así que tampoco la pide. */}
      {campos.esencia && form.tipo_producto !== 'comprado' && (
      <Field label="¿Con qué esencia se hace? (para el costeo)">
        <BuscadorSelect
          value={form.insumo_esencia_id}
          placeholder="— Sin asignar —"
          opciones={[
            { id: '', nombre: '— Sin asignar —' },
            ...ficha.esencias.map(e => ({ id: e.id, nombre: `${e.nombre} · ${formatPrice(e.precio)}/ml` })),
          ]}
          onSelect={id => setForm(f => ({ ...f, insumo_esencia_id: id === '' ? '' : Number(id) }))}
        />
        <p className="mt-1 text-[12px] text-muted-foreground">
          Cada fragancia cuesta distinto por ml, así que el costo de producirla depende de
          esto. Si lo dejas sin asignar, se usa la esencia por defecto del tamaño y el
          costo será aproximado.
        </p>
      </Field>
      )}

      {campos.esencia && (
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-[13px] text-foreground">
        <input
          type="checkbox" className="mt-0.5 size-4 accent-primary"
          checked={form.esencia_premium}
          onChange={e => setForm(f => ({ ...f, esencia_premium: e.target.checked }))}
        />
        <span>
          Esencia premium
          <span className="block text-[12px] font-normal text-muted-foreground">
            La esencia de mayor calidad del laboratorio. Lleva su distintivo en el
            catálogo y NUNCA entra en el precio de combo (no se puede colar en un
            combo por cantidad).
          </span>
        </span>
      </label>
      )}
      <FormError>{ficha.formError}</FormError>
      </>
      )}
    </Modal>
  );
}
