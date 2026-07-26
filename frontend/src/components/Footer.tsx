import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { WHATSAPP_NUMBER, BRAND_NAME } from '../config/constants';

const explorar = [
  { to: '/', label: 'Inicio' },
  { to: '/perfumes', label: 'Perfumes' },
  { to: '/combos', label: 'Combos' },
  { to: '/contactame', label: 'Contáctame' },
];

const legales = [
  { to: '/legal#terminos', label: 'Términos y condiciones' },
  { to: '/legal#datos', label: 'Tratamiento de datos' },
  { to: '/legal#marcas', label: 'Marcas e imágenes' },
];

const Col = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{titulo}</p>
    {children}
  </div>
);

const enlaceCls = 'text-[13.5px] text-foreground/80 transition-colors hover:text-primary w-fit';

/**
 * Pie de página con navegación, enlaces legales, contacto por WhatsApp y el aviso
 * de marcas/imágenes (los productos son en su mayoría contratipos y las fotos son
 * referenciales; las marcas pertenecen a sus titulares).
 */
export default function Footer() {
  const anio = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card/40 pb-24 pt-12 sm:pb-12">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 md:px-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marca */}
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
          <span className="inline-flex items-center gap-2 font-display text-[17px] font-medium tracking-wide text-ink">
            <BrandMark className="size-7" /> {BRAND_NAME}
          </span>
          <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            Perfumería con esencias premium. Contratipos, 1.1 y originales, con pedidos por
            WhatsApp — sin pagos en línea.
          </p>
        </div>

        <Col titulo="Explorar">
          {explorar.map((e) => (
            <Link key={e.to} to={e.to} className={enlaceCls}>{e.label}</Link>
          ))}
        </Col>

        <Col titulo="Legal">
          {legales.map((e) => (
            <Link key={e.to} to={e.to} className={enlaceCls}>{e.label}</Link>
          ))}
        </Col>

        <Col titulo="Contacto">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <MessageCircle className="size-4" /> Escríbenos por WhatsApp
          </a>
        </Col>
      </div>

      {/* Aviso legal + copyright */}
      <div className="mx-auto mt-10 w-full max-w-7xl border-t border-border/70 px-5 pt-6 md:px-8">
        <p className="text-[11.5px] leading-relaxed text-muted-foreground/80">
          Precios en pesos colombianos (COP). Muchos productos son <strong className="font-medium">contratipos</strong>{' '}
          (perfumes inspirados en fragancias reconocidas), no originales, salvo que se indique lo contrario.
          Las imágenes de productos son <strong className="font-medium">referenciales</strong>; las marcas, nombres y
          logotipos de terceros pertenecen a sus respectivos titulares y se usan solo como referencia olfativa.
          {' '}{BRAND_NAME} no está afiliada ni patrocinada por dichas marcas. Ver{' '}
          <Link to="/legal#marcas" className="underline underline-offset-2 hover:text-primary">aviso de marcas</Link>.
        </p>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <BrandMark className="size-4" /> © {anio} {BRAND_NAME}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
