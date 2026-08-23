import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import Modal from '../../../../components/Modal';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Field, FieldRow, FormError } from '../../ui';
import type { InventarioInsumo } from '../../types';
import type { InsumoAlcance, InsumoTipo, InsumoUnidad } from '../../../../domain/entities/cotizacion.types';

interface Gama { id: number; nombre: string; esencias: number }

const TIPOS: { valor: InsumoTipo; etiqueta: string; ayuda: string }[] = [
  { valor: 'materia_prima', etiqueta: 'Materia prima', ayuda: 'Esencia, diluyente, sellador, feromonas. Se miden en ml.' },
  { valor: 'envase', etiqueta: 'Envase', ayuda: 'El frasco de cada tamaño. Se cuenta por unidades.' },
  { valor: 'accesorio', etiqueta: 'Accesorio', ayuda: 'Bolsa, perfumero, caja, etiqueta…' },
];

interface Props {
  /** Null = crear uno nuevo; con valor = editar ese. */
  material: InventarioInsumo | null;
  onClose: () => void;
  onGuardado: () => void;
}

/**
 * Dar de alta o corregir un material.
 *
 * Vive en Inventario porque es donde el dueño trabaja con sus materiales. Antes
 * estaba en una pestaña aparte ("Insumos y precios") que mostraba exactamente
 * los mismos registros desde otro ángulo, y eso confundía: no se sabía dónde
 * estaba cada acción.
 *
 * OJO con el precio: solo se teclea al CREAR, como punto de partida. Después
 * lo calcula solo el costo promedio de las compras, y tecleárselo encima lo
 * falsearía.
 */
export function MaterialModal({ material, onClose, onGuardado }: Props) {
  const editando = material !== null;
  const [nombre, setNombre] = useState(material?.nombre ?? '');
  const [tipo, setTipo] = useState<InsumoTipo>((material?.tipo as InsumoTipo) ?? 'materia_prima');
  const [unidad, setUnidad] = useState<InsumoUnidad>((material?.unidad as InsumoUnidad) ?? 'ml');
  const [alcance, setAlcance] = useState<InsumoAlcance>('unidad');
  const [precio, setPrecio] = useState(editando ? String(material.costo_promedio) : '');
  const [gamaId, setGamaId] = useState<string>(material?.gama_id ? String(material.gama_id) : '');
  const [genero, setGenero] = useState<string>(material?.genero ?? '');
  // Las gamas son una tabla que el dueño amplía, así que se piden al servidor
  const [gamas, setGamas] = useState<Gama[]>([]);
  useEffect(() => {
    (async () => {
      const r = await http.get<{ data: Gama[] }>(urls.costeo.gamas);
      if (r.ok) setGamas(r.cuerpo?.data ?? []);
    })();
  }, []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  /** Al cambiar el tipo se propone la unidad natural, sin encerrar la elección. */
  const cambiarTipo = (t: InsumoTipo) => {
    setTipo(t);
    setUnidad(t === 'materia_prima' ? 'ml' : 'unidad');
  };

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Ponle un nombre'); return; }
    const p = Number(precio) || 0;
    if (p < 0) { setError('El costo no puede ser negativo'); return; }
    setGuardando(true); setError('');
    try {
      const cuerpo = {
        nombre: nombre.trim(), tipo, unidad, alcance, precio: p,
        // null y no '' : la columna admite nulo y '' no es una gama válida
        gama_id: tipo === 'materia_prima' && gamaId ? Number(gamaId) : null,
        genero: tipo === 'materia_prima' && genero ? genero : null,
        ...(editando ? { activo: material.activo } : {}),
      };
      const res = editando
        ? await http.patch(urls.costeo.insumo(material.id), cuerpo)
        : await http.post(urls.costeo.insumos, cuerpo);
      if (!res.ok) { setError(res.error); return; }
      toast.success(editando ? 'Material actualizado' : `"${nombre.trim()}" agregado`);
      onGuardado();
      onClose();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setGuardando(false); }
  };

  return (
    <Modal
      open onClose={onClose}
      title={editando ? `Editar ${material.nombre}` : 'Agregar material'}
      onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : (editando ? 'Guardar' : 'Agregar')}
      loading={guardando}
    >
      <Field label="¿Cómo se llama?">
        <Input value={nombre} maxLength={120} autoFocus
          placeholder="Ej: Esencia Khamrah"
          onChange={e => setNombre(e.target.value)} />
        {tipo === 'materia_prima' && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Cada esencia va por separado: Khamrah y Eternity cuestan distinto por ml, y
            juntarlas daría un costo que no es el de ninguna.
          </p>
        )}
      </Field>

      <FieldRow>
        <Field label="¿Qué es?">
          <SelectSimple value={tipo} onChange={e => cambiarTipo(e.target.value as InsumoTipo)}>
            {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </SelectSimple>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {TIPOS.find(t => t.valor === tipo)?.ayuda}
          </p>
        </Field>
        <Field label="¿Cómo se mide?">
          <SelectSimple value={unidad} onChange={e => setUnidad(e.target.value as InsumoUnidad)}>
            <option value="ml">Mililitros</option>
            <option value="unidad">Unidades</option>
          </SelectSimple>
        </Field>
      </FieldRow>

      {/* Se pregunta a TODA materia prima, no solo a las que llevan "esencia"
          en el nombre. Antes se decidía por el nombre y eso cerraba un círculo:
          una esencia llamada como su fragancia no veía esta casilla, así que no
          se podía clasificar, y sin gama tampoco aparecía al crear el perfume.
          Quedaba inservible sin decir por qué. El diluyente, el sellador y las
          feromonas simplemente se dejan sin clasificar. */}
      {tipo === 'materia_prima' && (
        <>
          <Field label="¿De qué gama es esta esencia?">
            {/* Mismo control que en el alta desde una compra: las gamas son una
                tabla que el dueño amplía, y tener dos desplegables distintos
                para el mismo dato se nota. */}
            <BuscadorSelect
              opciones={[
                { id: 0, nombre: '— Sin clasificar —' },
                ...gamas.map(g => ({ id: g.id as number | string, nombre: g.nombre })),
              ]}
              value={gamaId ? Number(gamaId) : 0}
              placeholder="Elegir gama…"
              onSelect={id => setGamaId(Number(id) ? String(id) : '')}
              vacio="Todavía no has creado gamas"
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              <strong>La gama es lo que marca este material como esencia</strong>: sin ella no
              aparecerá en la lista de "¿con qué esencia se hace?" al crear un perfume. Déjala
              sin clasificar solo si NO es una esencia (diluyente, sellador, feromonas).
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Además se usa para cotizar al mayoreo cuando el cliente pide "50 de 30 ml" sin
              decir qué fragancias: ahí se calcula con el promedio de la gama. Cuando sí se
              sabe cuál es el perfume, manda el costo de SU esencia.
            </p>
          </Field>

          {/* Solo 3 opciones fijas: aquí el buscador estorbaría. La mayoría de
              las esencias lo tiene vacío porque el nombre solo lo dice cuando
              hacía falta desempatar, así que este es el sitio donde se llena. */}
          <Field label="¿Para quién es esta fragancia?">
            <SelectSimple value={genero} onChange={e => setGenero(e.target.value)}>
              <option value="">— Todavía no sé —</option>
              <option value="dama">Dama</option>
              <option value="caballero">Caballero</option>
              <option value="unisex">Unisex</option>
            </SelectSimple>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Sirve para no confundir dos fragancias de la misma línea (un "212 VIP" de dama
              y otro de caballero) y para que el perfume que se cree con esta esencia salga
              ya clasificado.
            </p>
          </Field>
        </>
      )}

      {tipo === 'accesorio' && (
        <Field label="¿Se cobra por perfume o por pedido?">
          <SelectSimple value={alcance} onChange={e => setAlcance(e.target.value as InsumoAlcance)}>
            <option value="unidad">Por cada perfume (bolsa, perfumero, tarjeta)</option>
            <option value="pedido">Una vez por pedido (caja de envío)</option>
          </SelectSimple>
        </Field>
      )}

      {/* Editable también al editar: es la única forma de corregir un costo que
          entró mal (un cero de más al sembrar, un dato equivocado en la hoja).
          De ahí en adelante lo vuelve a llevar el promedio de las compras. */}
      <Field label={editando
        ? `Costo por ${unidad === 'ml' ? 'ml' : 'unidad'}`
        : '¿Cuánto te cuesta hoy? (opcional)'}>
        <Input type="number" min="0" step="0.0001" value={precio}
          placeholder="0"
          onChange={e => setPrecio(e.target.value)} />
        <p className="mt-1 text-[12px] text-muted-foreground">
          {editando
            ? 'Es el costo promedio que lleva hoy. Corrígelo solo si entró mal: cada compra que registres lo vuelve a calcular con lo que pagaste de verdad.'
            : 'Solo el punto de partida. De aquí en adelante lo calcula solo el costo promedio de tus compras. Si no lo sabes, déjalo vacío y se llena con la primera compra.'}
        </p>
      </Field>

      <FormError>{error}</FormError>
    </Modal>
  );
}
