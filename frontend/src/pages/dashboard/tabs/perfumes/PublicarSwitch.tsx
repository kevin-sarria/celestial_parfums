import { useState } from 'react';
import { toast } from 'sonner';
import Modal from '../../../../components/Modal';
import { BASE_URL } from '../../../../infrastructure/api/client';
import type { GuardedFetch } from '../../types';

interface Props {
  perfume: { id: number; nombre: string; publicado: boolean };
  guardedFetch: GuardedFetch;
  onCambiado: () => void;
}

/**
 * Interruptor "está en la tienda / está fuera".
 *
 * NO es lo mismo que agotado, y por eso son dos controles distintos:
 *  - **Agotado**: el cliente lo ve, marcado como agotado, y puede pedir que le
 *    avisen cuando vuelva. Sigue haciendo su trabajo de vitrina.
 *  - **Fuera de la tienda**: desaparece del catálogo como si no existiera.
 *    Es lo que sirve para lo que no se puede fabricar (no hay esencia de esa
 *    fragancia) y para las fichas a medio llenar.
 *
 * Pide confirmación ANTES de actuar porque toca la tienda de cara al público:
 * un clic sin querer en una tabla de 212 filas saca un producto de la venta y
 * nada en la pantalla lo grita. Al cancelar queda exactamente como estaba.
 */
export function PublicarSwitch({ perfume, guardedFetch, onCambiado }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const sacando = perfume.publicado; // lo que va a pasar si confirma

  const aplicar = async () => {
    setGuardando(true);
    try {
      const res = await guardedFetch(`${BASE_URL}/api/parfums/${perfume.id}/publicado`, {
        method: 'PATCH',
        body: JSON.stringify({ publicado: !perfume.publicado }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.error ?? 'No se pudo cambiar'); return; }
      toast.success(json?.message ?? 'Listo');
      setConfirmando(false);
      onCambiado();
    } catch {
      toast.error('No se pudo conectar con el servidor');
    } finally { setGuardando(false); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        title={perfume.publicado ? 'Sacar de la tienda' : 'Devolver a la tienda'}
        aria-pressed={perfume.publicado}
        className="flex cursor-pointer items-center gap-1.5"
      >
        <span
          className={`relative h-4.5 w-8 shrink-0 rounded-full transition-colors ${
            perfume.publicado ? 'bg-primary' : 'bg-muted-foreground/35'
          }`}
        >
          <span
            className={`absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-all ${
              perfume.publicado ? 'left-4' : 'left-0.5'
            }`}
          />
        </span>
        <span className={`text-[11.5px] ${perfume.publicado ? 'text-muted-foreground' : 'font-medium text-amber-700'}`}>
          {perfume.publicado ? 'En la tienda' : 'Fuera'}
        </span>
      </button>

      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title={sacando ? 'Sacar de la tienda' : 'Devolver a la tienda'}
        onSubmit={(e) => { e.preventDefault(); aplicar(); }}
        submitLabel={guardando ? 'Un momento…' : sacando ? 'Sí, sacarlo' : 'Sí, devolverlo'}
        loading={guardando}
        maxWidth={460}
      >
        <p className="text-[13.5px] leading-relaxed text-foreground">
          <strong>{perfume.nombre}</strong>{' '}
          {sacando
            ? 'va a desaparecer de tu tienda: no saldrá en el catálogo, ni en la búsqueda, ni en los destacados, y su página dejará de abrirse.'
            : 'vuelve a aparecer en tu tienda: sale otra vez en el catálogo, en la búsqueda y en su página.'}
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {sacando
            ? 'No se borra nada: sus datos, sus fotos y su historial de ventas quedan intactos, y puedes devolverlo cuando quieras. Si lo que pasa es que se te acabó pero lo sigues vendiendo, usa "Agotado" en vez de esto: así el cliente lo ve y puede pedir que le avises cuando vuelva.'
            : 'Revisa antes que tenga su foto, su precio y su esencia asignada: desde que lo devuelvas, cualquiera puede comprarlo.'}
        </p>
      </Modal>
    </>
  );
}
