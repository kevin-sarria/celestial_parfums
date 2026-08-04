import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../../components/Modal';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { BASE_URL } from '../../../../infrastructure/api/client';
import { formatPrice } from '../../helpers';
import { Field, FieldRow } from '../../ui';
import type { GuardedFetch, InventarioInsumo } from '../../types';

type Unidad = 'ml' | 'g' | 'l' | 'kg' | 'unidad';

interface SalidaModalProps {
  insumos: InventarioInsumo[];
  guardedFetch: GuardedFetch;
  onClose: () => void;
  /** Se llama tras guardar bien, para recargar el inventario. */
  onGuardado: () => void;
}

/**
 * Material que sale SIN venta.
 *
 * `muestra` y `merma` van separadas a propósito: la muestra es costo de
 * marketing (cuánto te cuesta dar a probar) y la merma es pérdida. Mezclarlas
 * esconde lo primero dentro de lo segundo.
 */
export function SalidaModal({ insumos, guardedFetch, onClose, onGuardado }: SalidaModalProps) {
  const [insumoId, setInsumoId] = useState<number | ''>('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState<Unidad>('ml');
  const [motivo, setMotivo] = useState<'muestra' | 'merma'>('muestra');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!insumoId || !(Number(cantidad) > 0)) {
      toast.error('Elige el insumo y cuánto salió', { id: 'salida' }); return;
    }
    setGuardando(true);
    try {
      const res = await guardedFetch(`${BASE_URL}/api/inventario/salidas`, {
        method: 'POST',
        body: JSON.stringify({
          insumo_id: insumoId, cantidad: Number(cantidad), unidad, motivo,
          fecha: new Date().toISOString().slice(0, 10),
          nota: nota.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo registrar', { id: 'salida' }); return; }
      toast.success(`Salida registrada: ${formatPrice(json.data?.costo ?? 0)}`);
      onGuardado();
      onClose();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'salida' }); }
    finally { setGuardando(false); }
  };

  return (
    <Modal open onClose={onClose} title="Registrar salida de material"
      onSubmit={guardar} submitLabel={guardando ? 'Guardando…' : 'Registrar'} loading={guardando}>
      <p className="text-[13px] text-muted-foreground">
        Material que sale <strong className="text-foreground">sin que haya venta</strong>: los
        rolones del mostrario, los minis que regalas, o algo que se derramó. Se valora al
        costo promedio del insumo.
      </p>

      <Field label="¿Qué insumo?">
        <BuscadorSelect
          value={insumoId}
          placeholder="— Elige el insumo —"
          opciones={insumos.map(i => ({
            id: i.id, nombre: `${i.nombre} · quedan ${i.stock} ${i.unidad}`,
          }))}
          onSelect={id => {
            setInsumoId(Number(id));
            const inv = insumos.find(x => x.id === Number(id));
            setUnidad(inv?.unidad === 'ml' ? 'ml' : 'unidad');
          }}
        />
      </Field>

      <FieldRow>
        <Field label="¿Cuánto salió?">
          <Input type="number" min="0" step="0.001" value={cantidad}
            onChange={e => setCantidad(e.target.value)} />
        </Field>
        <Field label="Unidad">
          <NativeSelect value={unidad} onChange={e => setUnidad(e.target.value as Unidad)}>
            <option value="ml">ml</option>
            <option value="g">gramos</option>
            <option value="l">litros</option>
            <option value="kg">kilos</option>
            <option value="unidad">unidades</option>
          </NativeSelect>
        </Field>
        <Field label="¿Por qué?">
          <NativeSelect value={motivo} onChange={e => setMotivo(e.target.value as 'muestra' | 'merma')}>
            <option value="muestra">Muestra / mostrario / regalo</option>
            <option value="merma">Se derramó o dañó</option>
          </NativeSelect>
        </Field>
      </FieldRow>

      <Field label="Nota (opcional)">
        <Input value={nota} maxLength={255}
          placeholder="Ej: rolones de la esencia nueva para el mostrador"
          onChange={e => setNota(e.target.value)} />
      </Field>

      <p className="text-[12px] text-muted-foreground">
        {motivo === 'muestra'
          ? 'Las muestras cuentan como inversión en vender, no como pérdida: se llevan aparte para que veas cuánto te cuesta dar a probar.'
          : 'Las mermas son plata perdida. Los gramos que se van de más al servir no hace falta anotarlos: los recoge el conteo físico.'}
      </p>
    </Modal>
  );
}
