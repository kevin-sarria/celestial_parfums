import { useState } from 'react';
import { toast } from 'sonner';
import { HistorialPagosModal, type PagoDelHistorial } from '../../../components/HistorialPagos';
import { formatPrice } from '../helpers';
import { fechaLegible } from '@/utils/calendario';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import type { Credito } from '../types';

/**
 * El historial de pagos de un crédito, visto desde el panel: el mismo que ve
 * el cliente en "Mi crédito", más el botón para borrar un abono equivocado
 * (el caso del abono doble del 2026-09-05, que antes solo se arreglaba en la
 * base de datos).
 */
export function PagosCreditoModal({ credito, onClose, onCambio }: {
  /** null = cerrado. */
  credito: Credito | null;
  onClose: () => void;
  /** El crédito como quedó, tal cual lo devolvió el servidor. */
  onCambio: (credito: Credito) => void;
}) {
  const [borrando, setBorrando] = useState<number | null>(null);

  const borrar = async (p: PagoDelHistorial) => {
    if (!credito || p.id == null) return;
    const dia = fechaLegible(p.fecha.slice(0, 10));
    if (!window.confirm(`¿Borrar el abono de ${formatPrice(p.monto)} del ${dia}? La deuda vuelve a subir en esa cifra.`)) return;
    setBorrando(p.id);
    try {
      const res = await http.borrar<{ data: Credito }>(urls.creditos.borrarAbono(credito.id, p.id));
      if (!res.ok || !res.cuerpo) { toast.error(res.error || 'No se pudo borrar el abono', { id: 'abono' }); return; }
      toast.success('Abono borrado');
      onCambio(res.cuerpo.data);
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'abono' }); }
    finally { setBorrando(null); }
  };

  return (
    <HistorialPagosModal
      credito={credito}
      titulo={credito ? `${credito.cliente.nombre} ${credito.cliente.apellido} · ${credito.articulos}` : undefined}
      onClose={onClose}
      onBorrar={borrar}
      borrandoId={borrando}
    />
  );
}
