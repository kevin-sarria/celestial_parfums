import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import Modal from '../../../components/Modal';
import { http } from '../../../infrastructure/api/http';
import { Field } from '../ui';

/**
 * PEDIR QUE SE BORRE (2026-10-04, decisión del dueño): quien no tiene permiso
 * de borrar ventas o créditos lo pide con un motivo, y solo el dueño aprueba
 * o rechaza en Solicitudes. Mientras tanto no se toca nada.
 */
export function PedirBorrado({ que, url, onCerrar }: {
  /** "la venta #812 de Ana" — lo que se va a pedir borrar, o null si está cerrado. */
  que: string | null;
  url: string;
  onCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (que) setMotivo(''); }, [que]);

  const enviar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!motivo.trim()) { toast.error('Escribe por qué hay que borrarla', { id: 'pedir-borrado' }); return; }
    setEnviando(true);
    try {
      const res = await http.post<{ message?: string }>(url, { motivo: motivo.trim() });
      if (!res.ok) { toast.error(res.error, { id: 'pedir-borrado' }); return; }
      toast.success(`${res.cuerpo?.message ?? 'Listo'}. Lo ves en Solicitudes.`, { id: 'pedir-borrado' });
      onCerrar();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'pedir-borrado' }); }
    finally { setEnviando(false); }
  };

  return (
    <Modal
      open={que != null}
      onClose={onCerrar}
      title="Pedir que se borre"
      onSubmit={enviar}
      submitLabel={enviando ? 'Enviando…' : 'Enviar al dueño'}
      loading={enviando}
      maxWidth={460}
    >
      <p className="text-[13px] text-muted-foreground">
        No tienes permiso para borrar {que}. Se lo pedimos al dueño: si lo aprueba, se borra y la mercancía vuelve al inventario.
      </p>
      <Field label="¿Por qué hay que borrarla? *">
        <Textarea rows={2} maxLength={300} value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: se registró dos veces" />
      </Field>
    </Modal>
  );
}
