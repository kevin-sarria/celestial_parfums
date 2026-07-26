import { ShoppingBag, Handshake } from 'lucide-react';
import WhatsAppIcon from './icons/WhatsAppIcon';

const PASOS = [
  {
    icono: <ShoppingBag className="size-5" />,
    titulo: '1. Arma tu pedido',
    texto: 'Agrega perfumes o combos al carrito. Los descuentos y precios de combo se aplican solos.',
  },
  {
    icono: <WhatsAppIcon size={20} />,
    titulo: '2. Envíalo por WhatsApp',
    texto: 'Sin pagos en línea ni formularios: tu pedido llega directo a nuestro chat.',
  },
  {
    icono: <Handshake className="size-5" />,
    titulo: '3. Coordinamos contigo',
    texto: 'Te confirmamos disponibilidad y acordamos el pago y la entrega, persona a persona.',
  },
];

/** Cómo funciona el pedido: sin caja, aire y hairline, para no romper el minimalismo. */
export default function ComoFunciona() {
  return (
    <section className="mt-20 border-t border-border/60 pt-14" aria-label="Cómo funciona tu pedido">
      <h2 className="mb-10 text-center font-display text-2xl font-light tracking-tight text-ink">
        Comprar es así de fácil
      </h2>
      <div className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-3">
        {PASOS.map((p) => (
          <div key={p.titulo} className="flex flex-col items-center gap-2.5 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-primary">
              {p.icono}
            </span>
            <p className="text-[14px] font-semibold text-ink">{p.titulo}</p>
            <p className="max-w-60 text-[13px] leading-relaxed text-muted-foreground">{p.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
