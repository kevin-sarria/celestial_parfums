import { useRef, useState } from 'react';
import { toast } from 'sonner';
import Modal from '../../../components/Modal';
import { formatPrice } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Field } from '../ui';
import type { Credito } from '../types';
import { CampoPesos } from '@/components/ui/campo-pesos';

interface AbonoModalProps {
  /** null = cerrado. */
  credito: Credito | null;
  onClose: () => void;
  /** El crédito como quedó, tal cual lo devolvió el servidor. */
  onCambio: (credito: Credito) => void;
}

/**
 * Registrar un abono. Los pagos ya hechos, y borrar uno equivocado, viven en
 * el historial de pagos (`PagosCreditoModal`).
 *
 * **No se puede guardar dos veces.** El 2026-09-05 un abono de $50.000 quedó
 * doble en producción: este modal era el único formulario de dinero que no se
 * bloqueaba al guardar, y el Enter iba conectado en crudo —cada pulsación, y
 * cada repetición de la tecla sostenida, mandaba otro abono mientras el
 * servidor respondía—. Ahora el Enter es el del `<form>` y `enVuelo` corta
 * cualquier envío mientras hay uno en camino. El servidor tiene su propio
 * freno (`addAbono`), por si algo se cuela por otra puerta.
 *
 * `enVuelo` es una ref y no solo el estado: el estado se actualiza en el
 * siguiente render, y dos Enter en el mismo instante lo verían aún en falso.
 */
export function AbonoModal({ credito, onClose, onCambio }: AbonoModalProps) {
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  // Al cerrar se vacía el campo: la próxima vez se abre limpio, sea el crédito que sea
  const cerrar = () => { setMonto(''); onClose(); };

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!credito || !(Number(monto) > 0) || enVuelo.current) return;
    enVuelo.current = true; setGuardando(true);
    try {
      const res = await http.patch<{ data: Credito }>(urls.creditos.abono(credito.id), { monto: Number(monto) });
      if (!res.ok || !res.cuerpo) { toast.error(res.error || 'No se pudo registrar el abono', { id: 'abono' }); return; }
      toast.success(`Abono de ${formatPrice(Number(monto))} registrado`);
      onCambio(res.cuerpo.data);
      cerrar();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'abono' }); }
    finally { enVuelo.current = false; setGuardando(false); }
  };

  return (
    <Modal
      open={credito !== null}
      onClose={cerrar}
      title="Registrar abono"
      maxWidth={400}
      onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : 'Guardar abono'}
      loading={guardando || !(Number(monto) > 0)}
    >
      {credito && (
        <p className="text-[13px] text-muted-foreground">
          {credito.cliente.nombre} {credito.cliente.apellido} debe{' '}
          <strong className="text-foreground">{formatPrice(credito.total_en_deuda)}</strong>{' '}
          de {formatPrice(credito.deuda_inicial)}.
          {credito.abonos.length > 0 && ` Lleva ${credito.abonos.length} ${credito.abonos.length === 1 ? 'pago' : 'pagos'}.`}
        </p>
      )}

      <Field label="Monto del abono (COP)">
        <CampoPesos value={monto} autoFocus
          onChange={e => setMonto(e.target.value)} />
      </Field>
    </Modal>
  );
}
