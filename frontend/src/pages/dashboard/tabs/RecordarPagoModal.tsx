import { useState, type FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import { datosDeCredito, rellenar, type PlantillaMensaje } from '../../../application/mensajes';
import { waLink } from '../../../utils/whatsapp';
import { hoy } from '../../../utils/fechas';
import type { Credito } from '../types';

interface Props {
  credito: Credito;
  /** Los mensajes del caso «credito». Vacío = todavía no ha escrito ninguno. */
  plantillas: PlantillaMensaje[];
  onClose: () => void;
}

/**
 * RECORDARLE EL PAGO POR WHATSAPP.
 *
 * Dos caminos, y el primero importa tanto como el segundo:
 *
 * - **Sin mensajes escritos**, no hay nada que mandar: el botón de la fila sale
 *   apagado y al tocarlo sale esto, que lo explica y lleva a escribirlo. Un
 *   botón deshabilitado de verdad no se podría ni tocar, y el dueño se quedaría
 *   sin saber por qué.
 * - **Con mensajes**, se elige la variante y se lee ANTES de mandarla: el texto
 *   sale a nombre del negocio y un cobro mal escrito cuesta un cliente.
 *
 * Nunca manda solo. Abre WhatsApp con el chat del cliente si su ficha tiene
 * teléfono, y si no, el selector de contactos con el mensaje ya escrito.
 */
export function RecordarPagoModal({ credito, plantillas, onClose }: Props) {
  const navigate = useNavigate();
  const [elegida, setElegida] = useState<number | null>(plantillas[0]?.id ?? null);

  const datos = datosDeCredito(credito, hoy());
  const mensajeDe = (p: PlantillaMensaje) => rellenar(p.texto, datos);

  if (plantillas.length === 0) {
    return (
      <Modal open onClose={onClose} title="Todavía no hay mensaje para cobrar" ocultarSubmit cancelLabel="Cerrar">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Este botón está apagado porque no tendría qué mandar. Escribe cómo le recuerdas
          el pago a tus clientes —relajado con unos, formal con otros— y se enciende solo.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          El nombre, lo que debe y la fecha los pone el sistema: tú solo escribes el mensaje.
        </p>
        <Button
          className="mt-3"
          onClick={() => { onClose(); navigate('/dashboard/mensajes'); }}
        >
          <MessageCircle className="size-4" /> Escribirlo ahora
        </Button>
      </Modal>
    );
  }

  const elegidaP = plantillas.find((p) => p.id === elegida) ?? plantillas[0];

  /** Se abre en una pestaña nueva: el dueño sigue teniendo el panel delante. */
  const abrirWhatsApp = (e: FormEvent) => {
    e.preventDefault();
    window.open(waLink(credito.cliente.telefono, mensajeDe(elegidaP)), '_blank', 'noreferrer');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Recordarle el pago a ${datos.nombre}`}
      onSubmit={abrirWhatsApp}
      submitLabel="Abrir WhatsApp"
      cancelLabel="Cerrar"
      maxWidth={560}
    >
      <p className="text-[13px] text-muted-foreground">
        Debe <strong className="font-medium text-foreground">{datos.saldo}</strong> y su
        crédito <strong className="font-medium text-foreground">{datos.vence}</strong>
        {credito.fecha_limite && <> (pactado para el {datos.fecha})</>}.
      </p>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          ¿Cuál le mandas?
        </p>
        <ul className="flex flex-col gap-2">
          {plantillas.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setElegida(p.id)}
                aria-pressed={p.id === elegidaP.id}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition',
                  p.id === elegidaP.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <span className="text-[13px] font-medium text-foreground">{p.nombre}</span>
                <span className="mt-1 block whitespace-pre-wrap text-[12.5px] text-muted-foreground">
                  {mensajeDe(p)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {credito.cliente.telefono
          ? 'Se abre el chat del cliente con el mensaje ya escrito: lo puedes cambiar antes de mandarlo.'
          : 'Este cliente no tiene teléfono guardado: se abre WhatsApp con el mensaje escrito y eliges el contacto.'}
      </p>
    </Modal>
  );
}
