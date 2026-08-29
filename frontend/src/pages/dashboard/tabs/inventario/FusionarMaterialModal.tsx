import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '../../../../components/Modal';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Field } from '../../ui';
import type { InventarioInsumo } from '../../types';

interface MovidosPorFusion {
  movimientos: number;
  compras: number;
  comoEnvase: number;
  comoEsencia: number;
  enAccesorios: number;
  enPerfumes: number;
  enTallas: number;
  enListasDeAccesorios: number;
  total: number;
}

interface Props {
  /** El DUPLICADO: el registro que desaparece. */
  material: InventarioInsumo;
  insumos: InventarioInsumo[];
  onClose: () => void;
  onGuardado: () => void;
}

/**
 * FUSIONAR DOS REGISTROS DEL MISMO MATERIAL.
 *
 * Nace de un caso real: el dueño acabó con dos fichas del mismo perfumero, las
 * dos con historia, y no podía borrar ninguna. Su miedo, textual, era que al
 * unirlas *"me descuente lo que esté antes"* y quedar en negativo.
 *
 * Por eso el aviso verde no es decoración: es la respuesta a esa pregunta, con
 * su número real delante. Y por eso la cuenta de lo que se va a mover se pide al
 * servidor en vez de estimarla aquí — una fusión no se deshace, así que lo que
 * se enseña antes de confirmar tiene que ser lo que de verdad va a pasar.
 */
export function FusionarMaterialModal({ material, insumos, onClose, onGuardado }: Props) {
  const [destinoId, setDestinoId] = useState<number | ''>('');
  const [movidos, setMovidos] = useState<MovidosPorFusion | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    http.get<{ data: { movidos: MovidosPorFusion } }>(urls.costeo.fusionInsumo(material.id))
      .then((r) => { if (vivo && r.ok && r.cuerpo?.data) setMovidos(r.cuerpo.data.movidos); });
    return () => { vivo = false; };
  }, [material.id]);

  const destino = insumos.find((i) => i.id === destinoId) ?? null;

  /** Solo lo que se movería de verdad: enseñar ocho ceros no informa, distrae. */
  const detalle = movidos ? ([
    [movidos.movimientos, 'movimiento'],
    [movidos.compras, 'compra'],
    [movidos.comoEnvase + movidos.comoEsencia + movidos.enAccesorios, 'receta'],
    [movidos.enPerfumes, 'perfume'],
    [movidos.enTallas + movidos.enListasDeAccesorios, 'talla'],
  ] as const).filter(([n]) => n > 0) : [];

  const fusionar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!destinoId) {
      toast.error('Elige con cuál material se fusiona', { id: 'fusion' });
      return;
    }
    setGuardando(true);
    try {
      const res = await http.post<{ message: string }>(
        urls.costeo.fusionInsumo(material.id), { destino_id: destinoId },
      );
      if (!res.ok) { toast.error(res.error, { id: 'fusion', duration: 9000 }); return; }
      toast.success(res.cuerpo?.message ?? 'Materiales fusionados');
      onGuardado();
      onClose();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'fusion' }); }
    finally { setGuardando(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Fusionar "${material.nombre}"`}
      onSubmit={fusionar} submitLabel={guardando ? 'Fusionando…' : 'Fusionar'} loading={guardando}>

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Para cuando el mismo material quedó registrado dos veces. Toda la historia de
        <strong className="text-foreground"> {material.nombre}</strong> pasa al material bueno, y
        este registro desaparece.
      </p>

      <Field label="¿Cuál es el material bueno? (el que se queda)">
        <BuscadorSelect
          value={destinoId}
          placeholder="— Elige el material que se queda —"
          opciones={insumos
            .filter((i) => i.id !== material.id)
            .map((i) => ({ id: i.id, nombre: `${i.nombre} · ${i.stock} en existencia` }))}
          onSelect={(id) => setDestinoId(id === '' ? '' : Number(id))}
        />
      </Field>

      {detalle.length > 0 && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[12.5px]">
          Se muda a su nombre:{' '}
          {detalle.map(([n, palabra], i) => (
            <span key={palabra}>
              {i > 0 && ' · '}
              <strong>{n}</strong> {palabra}{n === 1 ? '' : 's'}
            </span>
          ))}
          .
        </p>
      )}

      {/* La respuesta a lo que preguntó, con su número delante. */}
      {destino && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-900">
          Tus existencias <strong>no se mueven</strong>: «{destino.nombre}» sigue con{' '}
          <strong>{destino.stock}</strong>. La fusión muda la historia, no la vuelve a descontar.
          {material.stock !== 0 && (
            <> Las {material.stock} unidad(es) que figuraban en el duplicado se descartan.</>
          )}
        </p>
      )}

      <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] text-amber-800">
        <strong>Esto no se puede deshacer.</strong> «{material.nombre}» se borra y su historia queda
        a nombre del otro. Si solo quieres dejar de verlo, apágalo con el interruptor.
      </p>
    </Modal>
  );
}
