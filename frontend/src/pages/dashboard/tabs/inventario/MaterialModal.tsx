import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../../components/Modal';
import { BASE_URL } from '../../../../infrastructure/api/client';
import { Field, FieldRow, FormError } from '../../ui';
import type { GuardedFetch, InventarioInsumo } from '../../types';
import type { InsumoAlcance, InsumoTipo, InsumoUnidad } from '../../../../domain/entities/cotizacion.types';

/** Gama de la esencia; '' = sin clasificar. */
type Gama = '' | 'clasica' | 'arabe' | 'premium' | 'disenador';

/** Las esencias se reconocen por el nombre, igual que en el resto del módulo:
 *  el diluyente, el sellador y las feromonas también son materia prima. */
const pareceEsencia = (n: string) =>
  n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes('esencia');

const TIPOS: { valor: InsumoTipo; etiqueta: string; ayuda: string }[] = [
  { valor: 'materia_prima', etiqueta: 'Materia prima', ayuda: 'Esencia, diluyente, sellador, feromonas. Se miden en ml.' },
  { valor: 'envase', etiqueta: 'Envase', ayuda: 'El frasco de cada tamaño. Se cuenta por unidades.' },
  { valor: 'accesorio', etiqueta: 'Accesorio', ayuda: 'Bolsa, perfumero, caja, etiqueta…' },
];

interface Props {
  guardedFetch: GuardedFetch;
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
export function MaterialModal({ guardedFetch, material, onClose, onGuardado }: Props) {
  const editando = material !== null;
  const [nombre, setNombre] = useState(material?.nombre ?? '');
  const [tipo, setTipo] = useState<InsumoTipo>((material?.tipo as InsumoTipo) ?? 'materia_prima');
  const [unidad, setUnidad] = useState<InsumoUnidad>((material?.unidad as InsumoUnidad) ?? 'ml');
  const [alcance, setAlcance] = useState<InsumoAlcance>('unidad');
  const [precio, setPrecio] = useState(editando ? String(material.costo_promedio) : '');
  const [gama, setGama] = useState<Gama>((material?.gama as Gama) ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const esEsencia = pareceEsencia(nombre);

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
      const res = await guardedFetch(
        `${BASE_URL}/api/costeo/insumos${editando ? `/${material.id}` : ''}`,
        {
          method: editando ? 'PATCH' : 'POST',
          body: JSON.stringify({
            nombre: nombre.trim(), tipo, unidad, alcance, precio: p,
            // null y no '' : la columna admite nulo y '' no es una gama válida
            gama: tipo === 'materia_prima' && esEsencia && gama ? gama : null,
            ...(editando ? { activo: material.activo } : {}),
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error ?? 'No se pudo guardar'); return; }
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
          <NativeSelect value={tipo} onChange={e => cambiarTipo(e.target.value as InsumoTipo)}>
            {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </NativeSelect>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {TIPOS.find(t => t.valor === tipo)?.ayuda}
          </p>
        </Field>
        <Field label="¿Cómo se mide?">
          <NativeSelect value={unidad} onChange={e => setUnidad(e.target.value as InsumoUnidad)}>
            <option value="ml">Mililitros</option>
            <option value="unidad">Unidades</option>
          </NativeSelect>
        </Field>
      </FieldRow>

      {/* Solo tiene sentido en esencias: un frasco o el diluyente no tienen
          gama. Se pregunta con el nombre delante para que se entienda que va
          por la CALIDAD de la esencia, no por el perfume. */}
      {tipo === 'materia_prima' && esEsencia && (
        <Field label="¿De qué gama es esta esencia?">
          <NativeSelect value={gama} onChange={e => setGama(e.target.value as Gama)}>
            <option value="">— Sin clasificar —</option>
            <option value="clasica">Clásica (las de ~$230 a $280 el ml)</option>
            <option value="arabe">Árabe (~$350 a $480 el ml)</option>
            <option value="premium">Premium (~$1.500 el ml)</option>
            <option value="disenador">Diseñador</option>
          </NativeSelect>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Se usa para cotizar al mayoreo cuando el cliente pide "50 de 30 ml" sin decir
            qué fragancias: ahí se calcula con el promedio de la gama. Cuando sí se sabe
            cuál es el perfume, manda el costo de SU esencia.
          </p>
        </Field>
      )}

      {tipo === 'accesorio' && (
        <Field label="¿Se cobra por perfume o por pedido?">
          <NativeSelect value={alcance} onChange={e => setAlcance(e.target.value as InsumoAlcance)}>
            <option value="unidad">Por cada perfume (bolsa, perfumero, tarjeta)</option>
            <option value="pedido">Una vez por pedido (caja de envío)</option>
          </NativeSelect>
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
