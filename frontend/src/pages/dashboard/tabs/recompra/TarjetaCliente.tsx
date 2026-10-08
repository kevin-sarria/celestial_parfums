import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fechaLegible } from '@/utils/calendario';
import type { ClienteRecompra, EstadoRecompra } from './tipos';
import { waLink } from '../../../../utils/whatsapp';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export const ETIQUETA: Record<EstadoRecompra, string> = {
  le_toca: 'Le toca', pronto: 'Pronto', dormido: 'Dormido', al_dia: 'Al día',
};

const PILDORA: Record<EstadoRecompra, string> = {
  le_toca: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pronto: 'border-sky-200 bg-sky-50 text-sky-700',
  dormido: 'border-amber-200 bg-amber-50 text-amber-700',
  al_dia: 'border-border bg-secondary text-muted-foreground',
};

/** "Le tocaba hace 3 días", "Le toca en 4 días", "Sin volver hace 66 días". */
const cuando = (c: ClienteRecompra) => {
  const d = Math.abs(c.dias_para);
  if (c.dias_para === 0) return 'Le toca hoy';
  return c.dias_para < 0 ? `Le tocaba hace ${plural(d, 'día', 'días')}` : `Le toca en ${plural(d, 'día', 'días')}`;
};

/**
 * El mensaje sugerido. Se abre en WhatsApp para que el dueño lo lea y lo
 * cambie antes de mandarlo: es una sugerencia, no un envío automático. Al que
 * está dormido no se le pregunta por el perfume de hace meses, se le invita a
 * volver.
 */
/** "Khamrah 30ml" es uno; "2× Bade'e 30ml, Ralph 30ml…" son varios y no se enumeran en un saludo. */
const variosPerfumes = (referencia: string) => /,|\d+\s*[x×]\s/i.test(referencia);

export const mensajeDe = (c: ClienteRecompra) => {
  const nombre = c.nombre.split(' ')[0];
  const saludo = `¡Hola ${nombre}! Te escribo de Celestial Parfums 😊`;
  return c.estado === 'dormido'
    ? `${saludo} Hace rato no sabemos de ti. ¿Te cuento qué fragancias nuevas tenemos?`
    : variosPerfumes(c.ultima_referencia)
      ? `${saludo} ¿Cómo te han ido tus perfumes? Si ya se te están acabando, te los puedo tener listos.`
      : `${saludo} ¿Cómo te ha ido con tu ${c.ultima_referencia}? Si ya se te está acabando, te lo puedo tener listo.`;
};

/**
 * Un cliente de la lista. Tarjeta y no fila de tabla: se usa sobre todo desde
 * el celular, justo antes de abrir WhatsApp.
 *
 * El botón abre el chat DEL CLIENTE cuando su ficha tiene teléfono; si no, cae al
 * selector de contactos —el mensaje va escrito igual—. Medido el 2026-10-04: de
 * 37 fichas solo una tenía teléfono, por eso casi siempre se elegía a mano.
 */
import { usePlantillasMensaje } from '../../../../application/hooks/usePlantillasMensaje';
import { datosDeRecompra, rellenar } from '../../../../application/mensajes';

export function TarjetaCliente({ c }: { c: ClienteRecompra }) {
  const { plantillas } = usePlantillasMensaje('recompra');
  const mensajeParaCliente = plantillas.length > 0
    ? rellenar(plantillas[0].texto, datosDeRecompra(c))
    : mensajeDe(c);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensajeParaCliente);
      toast.success('Mensaje copiado');
    } catch { toast.error('No se pudo copiar el mensaje'); }
  };

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-medium text-foreground">{c.nombre}</p>
          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', PILDORA[c.estado])}>
            {ETIQUETA[c.estado]}
          </span>
        </div>
        <p className="truncate text-[12.5px] text-muted-foreground">
          Última compra: {fechaLegible(c.ultima)} · {c.ultima_referencia}
        </p>
        <p className="text-[12.5px] text-muted-foreground">
          {plural(c.compras, 'compra', 'compras')} · compra cada ~{plural(c.ritmo_dias, 'día', 'días')}
          {!c.ritmo_propio && ' (el típico: compró una sola vez)'} · <span className="font-medium text-foreground">{cuando(c)}</span>
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={copiar} aria-label={`Copiar mensaje para ${c.nombre}`}>
          <Copy className="size-4" /> Copiar
        </Button>
        <Button size="sm" asChild>
          <a href={waLink(c.telefono, mensajeParaCliente)} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </Button>
      </div>
    </li>
  );
}
