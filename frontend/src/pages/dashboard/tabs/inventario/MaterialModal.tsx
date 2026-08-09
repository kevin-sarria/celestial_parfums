import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../../components/Modal';
import { BASE_URL } from '../../../../infrastructure/api/client';
import { Field, FieldRow, FormError } from '../../ui';
import type { GuardedFetch, InventarioInsumo } from '../../types';
import type { InsumoAlcance, InsumoTipo, InsumoUnidad } from '../../../../domain/entities/cotizacion.types';

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
      const res = await guardedFetch(
        `${BASE_URL}/api/costeo/insumos${editando ? `/${material.id}` : ''}`,
        {
          method: editando ? 'PATCH' : 'POST',
          body: JSON.stringify({
            nombre: nombre.trim(), tipo, unidad, alcance, precio: p,
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

      {tipo === 'accesorio' && (
        <Field label="¿Se cobra por perfume o por pedido?">
          <NativeSelect value={alcance} onChange={e => setAlcance(e.target.value as InsumoAlcance)}>
            <option value="unidad">Por cada perfume (bolsa, perfumero, tarjeta)</option>
            <option value="pedido">Una vez por pedido (caja de envío)</option>
          </NativeSelect>
        </Field>
      )}

      {!editando && (
        <Field label="¿Cuánto te cuesta hoy? (opcional)">
          <Input type="number" min="0" step="0.0001" value={precio}
            placeholder="0"
            onChange={e => setPrecio(e.target.value)} />
          <p className="mt-1 text-[12px] text-muted-foreground">
            Solo el punto de partida. De aquí en adelante lo calcula solo el costo promedio
            de tus compras. Si no lo sabes, déjalo vacío y se llena con la primera compra.
          </p>
        </Field>
      )}

      <FormError>{error}</FormError>
    </Modal>
  );
}
