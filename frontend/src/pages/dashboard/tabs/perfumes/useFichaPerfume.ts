import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Perfume } from '../../../../domain/entities/perfume.schema';
import { esEsencia } from '../../../../domain/entities/insumo';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import type { Insumo } from '../../../../domain/entities/cotizacion.types';
import { subirImagenAdmin } from '../../helpers';
import type { Lookup, PerfumeForm, PrecioLista } from '../../types';
import { emptyPerfumeForm } from '../../types';

export interface UsarFichaArgs {
  aromas: Lookup[];
  ocasiones: Lookup[];
  presentaciones: Lookup[];
  onMutate: () => void;
  /**
   * Con qué arranca el formulario en `abrirNuevo` (se mezcla sobre
   * `emptyPerfumeForm()`). Sigue siendo editable: es un punto de partida,
   * no un candado. Sin esto, Productos y Perfumes abrían el mismo formulario
   * "en blanco" que en realidad ya traía `tipo_producto: 'fabricado'` —
   * y todo lo creado desde Productos se iba a la pestaña de Perfumes.
   */
  valoresIniciales?: Partial<PerfumeForm>;
}

/** Todo lo que la ficha necesita para vivir: estado, catálogos y acciones. */
export interface FichaPerfume {
  modal: { open: boolean; editId: number | null };
  form: PerfumeForm;
  setForm: React.Dispatch<React.SetStateAction<PerfumeForm>>;
  formError: string;
  formLoading: boolean;
  esencias: Insumo[];
  insumosProducto: Insumo[];
  envases: Insumo[];
  imgMode: 'url' | 'file';
  setImgMode: (m: 'url' | 'file') => void;
  uploading: boolean;
  precioDeLista: (presentacionId: number) => number | null;
  abrirNuevo: () => void;
  abrirEdicion: (p: Perfume) => void;
  cerrar: () => void;
  guardar: (e: { preventDefault(): void }) => Promise<void>;
  eliminar: (id: number) => Promise<void>;
  subirImagen: (e: { target: { files: FileList | null } }) => Promise<void>;
}

/**
 * El cerebro de la ficha de un perfume (crear / editar / borrar).
 *
 * Salió de `PerfumesTab.tsx` para que la pestaña de Productos use exactamente
 * la misma lógica en vez de copiarla: una regla vive en un solo sitio. La
 * pestaña se queda con la barra y la tabla; aquí vive el formulario.
 */
export function useFichaPerfume({ aromas, ocasiones, presentaciones, onMutate, valoresIniciales }: UsarFichaArgs): FichaPerfume {
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<PerfumeForm>(emptyPerfumeForm());
  const [formLoading, setFormLoading] = useState(false);
  // Esencias disponibles: una por fragancia, cada una con su costo real por ml
  const [esencias, setEsencias] = useState<Insumo[]>([]);
  const [insumosProducto, setInsumosProducto] = useState<Insumo[]>([]);
  const [envases, setEnvases] = useState<Insumo[]>([]);
  useEffect(() => {
    (async () => {
      const r = await http.get<{ data: Insumo[] }>(urls.costeo.insumos);
      if (!r.ok) return;
      const todos = r.cuerpo?.data ?? [];
      // Se reconocen por su GAMA, no por el nombre: ver `esEsencia`. Colgarlo de
      // la palabra "esencia" dejaba fuera a las que se llaman como su fragancia.
      setEsencias(todos.filter(esEsencia));
      // Para comprados/fraccionados: cualquier insumo puede SER el producto
      setInsumosProducto(todos);
      setEnvases(todos.filter((i: Insumo) => i.tipo === 'envase'));
    })();
  }, []);
  const [formError, setFormError] = useState('');
  const [imgMode, setImgMode] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
  const [precios, setPrecios] = useState<PrecioLista[]>([]);

  // La lista de precios se usa para mostrar qué cobra cada talla por defecto
  const cargarPrecios = async () => {
    try {
      const res = await http.get<{ data: PrecioLista[] }>(urls.perfumes.precios);
      if (res.ok) setPrecios(res.cuerpo?.data ?? []);
    } catch { /* sin lista, el form pide precio propio */ }
  };
  useEffect(() => { cargarPrecios(); }, []);

  /** Precio estándar de una presentación para la categoría elegida en el form. */
  const precioDeLista = (presentacionId: number) => {
    if (form.categoria_id === '') return null;
    return precios.find(
      p => p.categoria_id === form.categoria_id && p.presentacion_id === presentacionId,
    )?.precio ?? null;
  };

  const abrirNuevo = () => { setForm({ ...emptyPerfumeForm(), ...valoresIniciales }); setFormError(''); setImgMode('url'); setModal({ open: true, editId: null }); };
  const abrirEdicion = (p: Perfume) => {
    const aromaIds = aromas.filter(a => p.tipos_aroma.includes(a.nombre)).map(a => a.id);
    const ocasionIds = ocasiones.filter(o => p.ocasiones.includes(o.nombre)).map(o => o.id);
    const presentacionIds = presentaciones.filter(pr => p.presentaciones.includes(pr.nombre)).map(pr => pr.id);
    // Solo los precios marcados como propios vuelven al formulario: los demás
    // se dejan vacíos para que sigan heredando de la lista.
    const propios: Record<number, string> = {};
    for (const pp of p.precios ?? []) {
      if (!pp.propio) continue;
      const pres = presentaciones.find(pr => pr.nombre === pp.presentacion);
      if (pres) propios[pres.id] = String(pp.precio);
    }
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio),
      duracion: p.duracion ?? '', proyeccion: p.proyeccion ?? '', imagen_url: p.imagen_url ?? '',
      genero: p.genero ?? '', categoria_id: p.categoria_id ?? '',
      tipos_aroma: aromaIds, ocasiones: ocasionIds, presentaciones: presentacionIds,
      esencia_premium: p.esencia_premium ?? false, precios_propios: propios,
      insumo_esencia_id: p.insumo_esencia_id ?? '',
      tipo_producto: p.tipo_producto ?? 'fabricado',
      insumo_producto_id: p.insumo_producto_id ?? '',
      ml_utiles: p.ml_utiles ? String(p.ml_utiles) : '',
      solo_armado: p.solo_armado ?? false,
      es_accesorio: p.es_accesorio ?? false,
      envases_talla: Object.fromEntries(
        (p.precios ?? []).filter(pr => pr.envase_insumo_id)
          .map(pr => [pr.presentacion_id, pr.envase_insumo_id as number]),
      ),
    });
    setFormError(''); setImgMode('url'); setModal({ open: true, editId: p.id });
  };
  const cerrar = () => setModal({ open: false, editId: null });

  const subirImagen = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await subirImagenAdmin(file);
      setForm(f => ({ ...f, imagen_url: url }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al subir imagen');
    } finally { setUploading(false); }
  };

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.precio) { setFormError('Nombre y precio son obligatorios'); return; }
    setFormLoading(true); setFormError('');
    // Solo viajan los precios propios de las presentaciones marcadas
    const precios_propios = form.presentaciones
      .filter(id => Number(form.precios_propios[id]) > 0)
      .map(id => ({ presentacion_id: id, precio: Number(form.precios_propios[id]) }));
    const body = {
      nombre: form.nombre, descripcion: form.descripcion || null, precio: Number(form.precio),
      duracion: form.duracion || null, proyeccion: form.proyeccion || null,
      imagen_url: form.imagen_url || null, genero: form.genero || null,
      categoria_id: form.categoria_id !== '' ? Number(form.categoria_id) : null,
      tipos_aroma: form.tipos_aroma, ocasiones: form.ocasiones, presentaciones: form.presentaciones,
      esencia_premium: form.esencia_premium, precios_propios,
      insumo_esencia_id: form.insumo_esencia_id === '' ? null : form.insumo_esencia_id,
      tipo_producto: form.tipo_producto,
      insumo_producto_id: form.insumo_producto_id === '' ? null : form.insumo_producto_id,
      ml_utiles: Number(form.ml_utiles) || null,
      // Solo tiene sentido en lo que se fabrica: un comprado ya viene armado.
      solo_armado: form.tipo_producto === 'fabricado' && form.solo_armado,
      // Solo tiene sentido en lo comprado: si cambió de tipo después de marcarla,
      // la casilla se apaga sola en vez de que el servidor rechace el guardado.
      es_accesorio: form.tipo_producto === 'comprado' && form.es_accesorio,
      envases_talla: form.presentaciones.map(id => ({
        presentacion_id: id,
        envase_insumo_id: form.envases_talla[id] || null,
        accesorios: [],
      })),
    };
    try {
      const res = modal.editId
        ? await http.patch(urls.perfumes.actualizar(modal.editId), body)
        : await http.post(urls.perfumes.crear, body);
      if (!res.ok) { setFormError(res.error); return; }
      cerrar(); onMutate();
    } catch { setFormError('No se pudo conectar con el servidor'); }
    finally { setFormLoading(false); }
  };

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar este perfume? Esta acción no se puede deshacer.')) return;
    const res = await http.borrar(urls.perfumes.borrar(id));
    // Antes se ignoraba la respuesta: si el servidor lo rechazaba, la fila
    // seguía ahí y nadie sabía por qué.
    if (!res.ok) { toast.error(res.error, { id: 'perfume-del' }); return; }
    onMutate();
  };

  return {
    modal, form, setForm, formError, formLoading,
    esencias, insumosProducto, envases,
    imgMode, setImgMode, uploading,
    precioDeLista, abrirNuevo, abrirEdicion, cerrar, guardar, eliminar, subirImagen,
  };
}
