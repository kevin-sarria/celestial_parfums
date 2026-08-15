import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import Modal from '../../../../components/Modal';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Field, FieldRow } from '../../ui';

export interface Gama { id: number; nombre: string; esencias: number; stock_minimo?: number }

interface Props {
  gamas: Gama[];
  onClose: () => void;
  /**
   * Recibe la reposición YA recalculada por el servidor. La pantalla se
   * refresca con esto, sin volver a pedir nada.
   */
  onGuardado: (reposicion: unknown, minimos: Record<number, number>) => void;
}

/**
 * Cuándo avisar de cada gama.
 *
 * Vivía desplegado en la pantalla, ocupando una franja entera con cuatro
 * casillas y cuatro botones "ok" — el dueño pidió esconderlo detrás de un
 * botón, y tiene sentido: **es configuración, no la tarea del día.** Se toca
 * una vez y luego se consulta la lista cien veces.
 *
 * Guarda las cuatro de una sola vez. Antes era una petición por casilla (más
 * otra para recargar la lista): cinco viajes para un formulario de cuatro
 * campos, y si una fallaba la pantalla quedaba a medio guardar.
 */
export function MinimosModal({ gamas, onClose, onGuardado }: Props) {
  const [valores, setValores] = useState<Record<number, string>>(
    () => Object.fromEntries(gamas.map((g) => [g.id, String(g.stock_minimo ?? 0)])),
  );
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();

    // Validar ANTES de llamar: así el dueño sabe qué corregir sin esperar al
    // servidor, y no se pierde lo que escribió
    const minimos = gamas.map((g) => ({ id: g.id, minimo: Number(valores[g.id]) }));
    const mala = minimos.find((m) => !Number.isFinite(m.minimo) || m.minimo < 0);
    if (mala) {
      const gama = gamas.find((g) => g.id === mala.id);
      toast.error(`El mínimo de "${gama?.nombre}" tiene que ser un número de 0 en adelante`,
        { id: 'minimos' });
      return;
    }

    setGuardando(true);
    try {
      const res = await http.patch<{ message?: string; data: unknown }>(
        urls.inventario.minimosGama, { minimos },
      );
      if (!res.ok) { toast.error(res.error, { id: 'minimos' }); return; }
      toast.success(res.cuerpo?.message ?? 'Listo');
      onGuardado(res.cuerpo!.data, Object.fromEntries(minimos.map((m) => [m.id, m.minimo])));
      onClose();
    } catch {
      toast.error('No se pudo conectar con el servidor', { id: 'minimos' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="¿Cuándo te aviso?"
      onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : 'Guardar'}
      loading={guardando}
      maxWidth={520}
    >
      <p className="text-[12.5px] leading-snug text-muted-foreground">
        Pon el mínimo de cada gama y vale para todas sus esencias. Si una en concreto se
        mueve distinto, en Inventario puedes darle el suyo propio y ese manda.
      </p>

      <FieldRow>
        {gamas.map((g) => (
          // El conteo va en la etiqueta: es lo que evita subirle el mínimo a la
          // gama de 4 esencias creyendo que es la de 151
          <Field key={g.id} label={`${g.nombre} · ${g.esencias} ${g.esencias === 1 ? 'esencia' : 'esencias'}`}>
            <Input
              type="number" min="0" step="any"
              className="text-right tabular-nums"
              value={valores[g.id] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [g.id]: e.target.value }))}
            />
          </Field>
        ))}
      </FieldRow>

      <p className="text-[11.5px] text-muted-foreground">
        En mililitros. En <strong className="text-foreground">0</strong> no se avisa de esa gama.
      </p>
    </Modal>
  );
}
