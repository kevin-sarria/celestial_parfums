import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Modal from '../../../../components/Modal';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { EJEMPLO, MARCADORES, rellenar, type PlantillaMensaje } from '../../../../application/mensajes';
import { Field } from '../../ui';

interface Props {
  /** null = escribir uno nuevo. */
  plantilla: PlantillaMensaje | null;
  caso: string;
  onClose: () => void;
  onGuardado: (p: PlantillaMensaje, esNuevo: boolean) => void;
}

/**
 * El editor de UN mensaje: cómo lo llama, el texto, y debajo **cómo le va a
 * llegar al cliente**.
 *
 * La vista previa no es un adorno: el texto lleva marcas (`{saldo}`) y la única
 * forma de saber si quedaron bien puestas es verlo armado. Es el mismo relleno
 * que usa el botón de verdad, así que lo que se ve aquí es lo que sale.
 */
export function MensajeForm({ plantilla, caso, onClose, onGuardado }: Props) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '');
  const [texto, setTexto] = useState(plantilla?.texto ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  /**
   * Mete la marca donde esté el cursor y lo deja justo DETRÁS: si no, habría
   * que volver a buscar el sitio a mano cada vez.
   */
  const insertar = (marca: string) => {
    const el = area.current;
    const desde = el?.selectionStart ?? texto.length;
    const hasta = el?.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, desde) + marca + texto.slice(hasta));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(desde + marca.length, desde + marca.length);
    });
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !texto.trim()) { setError('Ponle un nombre y escríbelo'); return; }
    setGuardando(true); setError('');
    const cuerpo = { caso, nombre: nombre.trim(), texto: texto.trim() };
    try {
      const res = plantilla
        ? await http.patch<{ data: PlantillaMensaje }>(urls.mensajes.mensaje(plantilla.id), cuerpo)
        : await http.post<{ data: PlantillaMensaje }>(urls.mensajes.crear, cuerpo);
      if (!res.ok || !res.cuerpo) { setError(res.error || 'No se pudo guardar el mensaje'); return; }
      toast.success(plantilla ? 'Mensaje actualizado' : 'Mensaje guardado');
      onGuardado(res.cuerpo.data, !plantilla);
    } catch {
      setError('No se pudo guardar el mensaje');
    } finally { setGuardando(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={plantilla ? 'Editar mensaje' : 'Escribir un mensaje'}
      onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : 'Guardar'}
      loading={guardando}
      maxWidth={620}
    >
      <Field label="¿Cómo lo llamas? *">
        <Input
          value={nombre}
          maxLength={60}
          placeholder="Relajado, Formal, Al mayorista…"
          onChange={(e) => setNombre(e.target.value)}
        />
      </Field>

      <Field label="El mensaje *">
        <Textarea
          ref={area}
          value={texto}
          rows={5}
          maxLength={1000}
          placeholder="ey bro, como vamos? te recuerdo que tu crédito {vence} — son {saldo}"
          onChange={(e) => setTexto(e.target.value)}
        />
      </Field>

      {/* Botones y no sintaxis: nadie tiene que aprenderse las llaves. */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Meter un dato
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MARCADORES.map((m) => (
            <Button
              key={m.marca}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[12px]"
              title={m.que}
              onClick={() => insertar(m.marca)}
            >
              + {m.marca}
            </Button>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {MARCADORES.map((m) => `${m.marca} ${m.que.toLowerCase()}`).join(' · ')}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-3.5">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Así le llega
        </p>
        {texto.trim() ? (
          <p className="whitespace-pre-wrap text-[13px] text-foreground">{rellenar(texto, EJEMPLO)}</p>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Escribe el mensaje y aquí lo ves con datos de ejemplo.
          </p>
        )}
      </div>

      {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
    </Modal>
  );
}
