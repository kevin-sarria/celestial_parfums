import { useEffect, useState } from 'react';
import Modal from '../../../../components/Modal';
import { formatPrice } from '../../helpers';
import { MetaGanancia } from './MetaGanancia';
import { metaValida, textoMeta, type Meta } from './sugerencia';

/**
 * La meta propia de UN original (opción B del dueño): un caso puntual que
 * manda sobre la general, por ejemplo "con este gano $10.000 para ganarme al
 * cliente". Se guarda en el perfume y se quita con "Usar la general".
 */
export function MetaPropiaModal({ perfume, metaPropia, metaGeneral, onCerrar, onGuardar }: {
  /** null = cerrado. */
  perfume: string | null;
  metaPropia: Meta | null;
  metaGeneral: Meta;
  onCerrar: () => void;
  onGuardar: (meta: Meta | null) => Promise<boolean>;
}) {
  const [meta, setMeta] = useState<Meta>(metaPropia ?? metaGeneral);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (perfume) setMeta(metaPropia ?? metaGeneral); }, [perfume]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async (m: Meta | null) => {
    setGuardando(true);
    const ok = await onGuardar(m);
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <Modal
      open={perfume != null}
      onClose={onCerrar}
      title={`Meta propia · ${perfume ?? ''}`}
      onSubmit={e => { e.preventDefault(); if (metaValida(meta)) guardar(meta); }}
      submitLabel={guardando ? 'Guardando…' : 'Guardar meta'}
      loading={guardando}
      maxWidth={480}
    >
      <p className="text-[13px] text-muted-foreground">
        Manda sobre la meta general ({textoMeta(metaGeneral, formatPrice)}) solo en este perfume, en todas sus tallas.
      </p>
      <MetaGanancia etiqueta="Con este quiero ganar" meta={meta} onChange={setMeta} />
      {!metaValida(meta) && <p className="text-[12.5px] text-destructive">En porcentaje va de 1 a 90.</p>}
      {metaPropia && (
        <button type="button" className="text-[12.5px] font-medium text-primary underline underline-offset-2"
          disabled={guardando} onClick={() => guardar(null)}>
          Quitar la meta propia y usar la general
        </button>
      )}
    </Modal>
  );
}
