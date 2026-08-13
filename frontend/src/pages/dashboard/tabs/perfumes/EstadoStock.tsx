import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { API } from '../../helpers';
import type { Perfume } from '../../../../domain/entities/perfume.schema';
import type { GuardedFetch } from '../../types';

/**
 * Por qué sale agotado, dicho con los números que lo explican.
 *
 * "Sin esencia" a secas obligaría a ir a buscar el material a otra pantalla
 * para entender qué falta.
 */
const motivoSinEsencia = (p: Perfume) => {
  if (p.insumo_esencia_id == null) {
    return 'Este perfume no tiene esencia asignada, así que no se sabe con qué armarlo. '
      + 'Asígnasela en su ficha del catálogo.';
  }
  const tiene = p.insumo_esencia_stock ?? 0;
  const cola = ' Sale agotado en la tienda hasta que registres la llegada del material.';
  return p.esencia_necesaria != null
    ? `Tienes ${tiene} ml de su esencia y hacen falta ${p.esencia_necesaria} para armar uno.${cola}`
    : `Su esencia está en ${tiene}.${cola}`;
};

/**
 * Disponibilidad de un perfume en la tienda.
 *
 * Son DOS cosas distintas y por eso se ven distinto:
 *
 *  - **La marca manual** ("se me acabó"), que es la única que se puede tocar
 *    desde aquí. Es la que el dueño usa para generar urgencia sin sacar el
 *    perfume del catálogo: sigue visible, marcado, y el cliente puede pedir
 *    que le avisen cuando vuelva.
 *  - **Sin esencia**, que lo CALCULA el servidor midiendo el stock de la
 *    esencia contra lo que pide una unidad de la talla más pequeña. No se
 *    desmarca con un clic: se arregla registrando el material que llegó.
 *
 * Enseñar solo "Agotado" sin decir cuál de las dos es dejaría al dueño
 * intentando desmarcar algo que no depende de este botón — exactamente la
 * confusión que ya tuvo con el interruptor de publicar.
 */
export function EstadoStock({ perfume, guardedFetch, onCambiado }: {
  perfume: Perfume; guardedFetch: GuardedFetch; onCambiado: () => void;
}) {
  const [guardando, setGuardando] = useState(false);

  const alternar = async () => {
    setGuardando(true);
    try {
      const res = await guardedFetch(`${API}/${perfume.id}/agotado`, {
        method: 'PATCH',
        body: JSON.stringify({ agotado: !perfume.agotado_manual }),
      });
      // Antes esta respuesta no se miraba: si el servidor rechazaba, la fila se
      // quedaba igual y nadie se enteraba de por qué.
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error ?? 'No se pudo cambiar el stock', { id: 'stock' });
        return;
      }
      onCambiado();
    } catch {
      toast.error('No se pudo conectar con el servidor', { id: 'stock' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Con borde y hover a propósito: al lado del interruptor de publicar, un
          badge suelto se lee como una etiqueta de estado y no como algo que se
          puede tocar (el dueño llegó a creer que la función se había quitado). */}
      <button
        type="button"
        onClick={alternar}
        disabled={guardando}
        title={perfume.agotado_manual
          ? 'Marcarlo como disponible otra vez'
          : 'Marcarlo como agotado: se sigue viendo en la tienda, y el cliente puede pedir que le avises'}
        className="cursor-pointer rounded-full border border-border bg-card px-2 py-0.5 text-[11px]
                   font-medium transition-colors hover:border-primary/40 hover:text-primary
                   disabled:cursor-default disabled:opacity-50"
      >
        {perfume.agotado_manual
          ? <span className="text-muted-foreground">Agotado</span>
          : <span className="text-primary">En stock</span>}
      </button>

      {perfume.sin_esencia && (
        <Badge
          variant="outline"
          title={motivoSinEsencia(perfume)}
          className="cursor-help border-amber-400/50 bg-amber-400/10 text-[10px] text-amber-700"
        >
          Sin esencia
        </Badge>
      )}
    </div>
  );
}
