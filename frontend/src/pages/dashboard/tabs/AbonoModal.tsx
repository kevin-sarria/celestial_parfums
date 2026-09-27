import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '../../../components/Modal';
import { fmtDate, formatPrice } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Field } from '../ui';
import type { Credito, CreditoAbono } from '../types';

interface AbonoModalProps {
  /** null = cerrado. */
  credito: Credito | null;
  onClose: () => void;
  /** El crédito como quedó, tal cual lo devolvió el servidor. */
  onCambio: (credito: Credito) => void;
}

/**
 * Registrar un abono y, si hace falta, borrar uno equivocado.
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
  const [borrando, setBorrando] = useState<number | null>(null);
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

  const borrar = async (a: CreditoAbono) => {
    if (!credito) return;
    if (!window.confirm(`¿Borrar el abono de ${formatPrice(a.monto)} del ${fmtDate(a.fecha)}? La deuda vuelve a subir en esa cifra.`)) return;
    setBorrando(a.id);
    try {
      const res = await http.borrar<{ data: Credito }>(urls.creditos.borrarAbono(credito.id, a.id));
      if (!res.ok || !res.cuerpo) { toast.error(res.error || 'No se pudo borrar el abono', { id: 'abono' }); return; }
      toast.success('Abono borrado');
      onCambio(res.cuerpo.data);
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'abono' }); }
    finally { setBorrando(null); }
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
        </p>
      )}

      <Field label="Monto del abono (COP)">
        <Input type="number" min="1" inputMode="numeric" value={monto} autoFocus
          onChange={e => setMonto(e.target.value)} />
      </Field>

      {credito && credito.abonos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12.5px] font-semibold text-foreground/80">
            Abonos registrados ({credito.abonos.length})
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {credito.abonos.map(a => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                <span className="flex-1 text-muted-foreground">{fmtDate(a.fecha)}</span>
                <span className="font-semibold tabular-nums">{formatPrice(a.monto)}</span>
                <Button
                  type="button" variant="ghost" size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Borrar abono de ${formatPrice(a.monto)}`}
                  disabled={borrando !== null}
                  onClick={() => borrar(a)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
