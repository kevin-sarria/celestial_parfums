import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { GuardedFetch } from './types';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

interface Notificacion {
  id: string;
  texto: string;
  tab: string;
  tono: 'urgente' | 'aviso' | 'info';
}

/** El color solo REFUERZA la urgencia; el texto ya la dice por sí solo. */
const PUNTO: Record<Notificacion['tono'], string> = {
  urgente: 'bg-destructive',
  aviso: 'bg-amber-500',
  info: 'bg-primary/60',
};

/**
 * Centro de notificaciones del dashboard.
 *
 * Lo pidió el dueño después de encontrarse la lista de material bajo mínimo
 * pintada entera sobre Inventario: **55 renglones** ocupando la pantalla, cada
 * vez que entraba. Su queja fue exacta — *"muy feo ese mensaje ultra largo […]
 * que el mensaje sea muy breve"*.
 *
 * Reglas de la pieza:
 *
 * - **Una línea por aviso, y empieza por el número.** El detalle vive en la
 *   pantalla a la que lleva; repetirlo aquí es lo que produjo el muro.
 * - **Se carga al abrir**, no cada pocos segundos: son datos que cambian
 *   cuando el dueño hace algo, y estar pidiéndolos solo gasta servidor.
 * - **Si la carga falla se dice DENTRO del panel**, no con un toast. Un aviso
 *   flotante al entrar al dashboard molestaría en cada recarga; pero dejar la
 *   campana muda haría creer que no hay nada pendiente, que es peor.
 */
export default function CentroNotificaciones({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const navigate = useNavigate();
  const [avisos, setAvisos] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const res = await http.get<{ data?: Notificacion[] }>(urls.notificaciones);
      if (!res.ok) { setError(true); return; }
      setAvisos(res.cuerpo?.data ?? []);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [guardedFetch]);

  useEffect(() => { cargar(); }, [cargar]);

  const total = avisos.length;

  return (
    <DropdownMenu onOpenChange={(abierto) => { if (abierto) cargar(); }}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label={total > 0 ? `Notificaciones: ${total} sin revisar` : 'Notificaciones'}
        >
          <Bell className="size-4" />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4.5 text-white">
              {total}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notificaciones
          {total > 0 && <span className="text-[11px] font-normal text-muted-foreground">{total}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {cargando && (
          <p className="px-2 py-3 text-center text-[12.5px] text-muted-foreground">Mirando…</p>
        )}

        {!cargando && error && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); cargar(); }}>
            <span className="text-[12.5px] text-destructive">
              No se pudieron cargar los avisos. Toca para reintentar.
            </span>
          </DropdownMenuItem>
        )}

        {!cargando && !error && total === 0 && (
          <p className="px-2 py-3 text-center text-[12.5px] text-muted-foreground">
            Todo al día. No hay nada pendiente.
          </p>
        )}

        {!cargando && !error && avisos.map((a) => (
          <DropdownMenuItem
            key={a.id}
            className={cn('items-start gap-2.5 py-2', !a.tab && 'cursor-default')}
            // Sin pestaña a donde ir (el respaldo se abre desde el menú lateral)
            // la línea informa y no lleva a ningún lado, así que tampoco se cierra
            // el panel al tocarla por error.
            onSelect={(e) => { if (a.tab) navigate(`/dashboard/${a.tab}`); else e.preventDefault(); }}
          >
            <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', PUNTO[a.tono])} />
            <span className="flex-1 text-[12.5px] leading-snug">{a.texto}</span>
            {a.tab && <ChevronRight className="mt-0.5 size-3.5 shrink-0 opacity-40" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
