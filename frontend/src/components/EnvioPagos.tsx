import { Truck, Wallet, MessageCircle } from 'lucide-react';
import { ENVIO, PAGOS } from '../config/negocio';

const ITEMS = [
  { icon: Truck, titulo: ENVIO.cobertura, texto: `${ENVIO.tiempo} · ${ENVIO.transportadoras.join(' y ')}` },
  { icon: Wallet, titulo: 'Pago anticipado', texto: PAGOS.metodos.join(' · ') },
  { icon: MessageCircle, titulo: 'Asesoría por WhatsApp', texto: 'Te ayudamos a elegir tu fragancia' },
];

/** Franja de confianza minimalista (sin caja): hairlines y aire, estilo lujo. */
export default function EnvioPagos() {
  return (
    <section aria-label="Envíos y pagos" className="border-y border-border/60 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
        {ITEMS.map(({ icon: Icon, titulo, texto }) => (
          <div key={titulo} className="flex items-center justify-center gap-3 sm:justify-start">
            <Icon className="size-5 shrink-0 text-primary/80" strokeWidth={1.5} />
            <div className="text-left">
              <p className="text-[13px] font-medium text-ink">{titulo}</p>
              <p className="text-[12px] text-muted-foreground">{texto}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
