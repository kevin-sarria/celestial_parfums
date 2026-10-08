import { useEffect, useState } from 'react';
import { MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import {
  CASOS_MENSAJE, EJEMPLO, EJEMPLO_POR_CASO, rellenar, type CasoMensaje, type PlantillaMensaje,
} from '../../../application/mensajes';
import { useAuthContext } from '../../../application/context/useAuthContext';
import { EncabezadoPagina, Section, SectionTitle } from '../ui';
import { MensajeForm } from './mensajes/MensajeForm';

/**
 * EL MAESTRO DE MENSAJES.
 *
 * Los textos de WhatsApp que el panel manda vivían DENTRO DEL CÓDIGO: cambiar
 * una coma era un despliegue, y el dueño escribe distinto según el cliente
 * —*"ey bro, como vamos"* a uno joven, algo formal a uno mayor—, así que un
 * texto fijo nunca le servía. Aquí los escribe él, con varias variantes por
 * caso, y el botón que los usa le deja escoger.
 *
 * **Nace vacío a propósito**: el sistema no inventa su voz. Mientras un caso no
 * tenga ninguna variante, el botón que la usaría sale apagado y lo explica.
 */
export function MensajesTab() {
  const { isAdmin } = useAuthContext();
  const [caso, setCaso] = useState<CasoMensaje>(CASOS_MENSAJE[0].id);
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /** null = cerrado · 'nuevo' = escribiendo uno · la plantilla = editándola. */
  const [editando, setEditando] = useState<PlantillaMensaje | 'nuevo' | null>(null);
  const [borrando, setBorrando] = useState<PlantillaMensaje | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: PlantillaMensaje[] }>(urls.mensajes.lista);
      if (!res.ok) throw new Error(res.error);
      setPlantillas(res.cuerpo?.data ?? []);
      setError('');
    } catch (e) {
      // Sin este catch/finally la pantalla se queda en "Cargando…" para siempre.
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los mensajes');
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const delCaso = plantillas.filter((p) => p.caso === caso);
  const casoActual = CASOS_MENSAJE.find((c) => c.id === caso) ?? CASOS_MENSAJE[0];

  const confirmarBorrado = async () => {
    if (!borrando) return;
    const res = await http.borrar(urls.mensajes.mensaje(borrando.id));
    if (!res.ok) { toast.error(res.error || 'No se pudo borrar'); return; }
    toast.success('Mensaje borrado');
    setPlantillas((ps) => ps.filter((p) => p.id !== borrando.id));
    setBorrando(null);
  };

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Mensajes" count={plantillas.length}>
        {isAdmin && (
          <Button onClick={() => setEditando('nuevo')}>
            <Plus className="size-4" /> Escribir un mensaje
          </Button>
        )}
      </EncabezadoPagina>

      <p className="rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
        Aquí escribes los mensajes de WhatsApp con tu tono. Los datos del cliente
        —el nombre, lo que debe, cuándo vence— los mete el sistema solo: donde
        quieras que vayan, metes una <strong className="text-foreground">marca</strong> con los
        botones del editor.
      </p>

      {/* Selector de caso: cobrar, recompra, reposición, cotización */}
      <div role="tablist" aria-label="Casos de mensajes" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {CASOS_MENSAJE.map((c) => {
          const activa = caso === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setCaso(c.id)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[13px] font-medium leading-normal transition-colors cursor-pointer',
                activa
                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                  : 'border-border bg-card text-foreground hover:bg-secondary',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <Section>
        <SectionTitle count={delCaso.length}>{casoActual.label}</SectionTitle>
        <p className="mb-3 text-[12.5px] text-muted-foreground">{casoActual.ayuda}</p>

        {error && (
          <p className="mb-3 flex flex-wrap items-center gap-3 text-[13px] font-medium text-destructive">
            {error}
            <Button size="sm" variant="outline" className="h-7" onClick={cargar}>Reintentar</Button>
          </p>
        )}

        {cargando ? (
          <p className="text-[13px] text-muted-foreground">Cargando…</p>
        ) : delCaso.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3.5 py-4">
            <p className="text-[13px] font-medium text-foreground">Todavía no has escrito ninguno</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {caso === 'credito'
                ? 'Mientras no haya ninguno, el botón «Recordar el pago» de un crédito sale apagado: no tendría qué mandar. Escribe el primero y se enciende.'
                : `Aún no tienes mensajes para ${casoActual.label.toLowerCase()}. Escribe el primero y se usará al mandar por WhatsApp.`}
            </p>
            {isAdmin && (
              <Button className="mt-3" size="sm" onClick={() => setEditando('nuevo')}>
                <MessageSquareText className="size-4" /> Escribir el primero
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {delCaso.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13.5px] font-medium text-foreground">{p.nombre}</p>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        title="Editar" onClick={() => setEditando(p)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="Borrar" onClick={() => setBorrando(p)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {/* Con datos de ejemplo y con el MISMO relleno del botón: lo que
                    se ve aquí es exactamente lo que le llega al cliente. */}
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-muted-foreground">
                  {rellenar(p.texto, EJEMPLO_POR_CASO[caso] ?? EJEMPLO)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {editando && (
        <MensajeForm
          key={editando === 'nuevo' ? 'nuevo' : editando.id}
          plantilla={editando === 'nuevo' ? null : editando}
          caso={caso}
          onClose={() => setEditando(null)}
          onGuardado={(p, esNuevo) => {
            setPlantillas((ps) => (esNuevo ? [...ps, p] : ps.map((x) => (x.id === p.id ? p : x))));
            setEditando(null);
          }}
        />
      )}

      <Modal
        open={!!borrando}
        onClose={() => setBorrando(null)}
        title="¿Borrar este mensaje?"
        onSubmit={(e) => { e.preventDefault(); confirmarBorrado(); }}
        submitLabel="Borrar"
      >
        <p className="text-[13px] text-muted-foreground">
          «{borrando?.nombre}» dejará de estar disponible para mandarlo. No se puede deshacer.
        </p>
      </Modal>
    </div>
  );
}
