import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, ShieldCheck, Copyright } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import { WHATSAPP_NUMBER, BRAND_NAME } from '../config/constants';
import { useSeo } from '../application/hooks/useSeo';

const WA = `https://wa.me/${WHATSAPP_NUMBER}`;
const ACTUALIZADO = 'julio de 2026';

const SECCIONES = [
  { id: 'terminos', label: 'Términos y condiciones', icon: FileText },
  { id: 'datos', label: 'Tratamiento de datos', icon: ShieldCheck },
  { id: 'marcas', label: 'Marcas e imágenes', icon: Copyright },
];

const Wa = () => (
  <a href={WA} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
    WhatsApp
  </a>
);

/** H2 de sección con ancla para los enlaces del footer (/legal#id). */
const Seccion = ({ id, icon: Icon, titulo, children }: {
  id: string; icon: typeof FileText; titulo: string; children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="flex items-center gap-2.5 font-display text-2xl font-light text-ink">
      <Icon className="size-5 text-primary" /> {titulo}
    </h2>
    <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
      {children}
    </div>
  </section>
);

const Item = ({ children }: { children: React.ReactNode }) => (
  <li className="relative pl-5 before:absolute before:left-0 before:top-2.5 before:size-1.5 before:rounded-full before:bg-primary/60">
    {children}
  </li>
);

/**
 * Página legal: términos de venta por WhatsApp, tratamiento de datos (Ley 1581
 * de 2012) y aviso de marcas/imágenes (contratipos + fotos referenciales).
 */
export default function LegalPage() {
  useSeo('Información legal', 'Términos y condiciones, tratamiento de datos personales y aviso de marcas e imágenes de Celestial Parfums.');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink">Información legal</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Última actualización: {ACTUALIZADO}</p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Índice */}
          <nav className="h-fit lg:sticky lg:top-24">
            <ul className="flex flex-col gap-1">
              {SECCIONES.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-primary">
                    <s.icon className="size-4 shrink-0" /> {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-12">
            <Seccion id="terminos" icon={FileText} titulo="Términos y condiciones">
              <p>
                {BRAND_NAME} es una tienda de perfumería que ofrece su catálogo en línea y gestiona la
                venta y atención <strong>por WhatsApp</strong>. El sitio no procesa pagos en línea.
              </p>
              <ul className="space-y-2">
                <Item><strong>Precios:</strong> se muestran en pesos colombianos (COP) e incluyen los
                  descuentos y precios de combo cuando aplican. Pueden cambiar sin previo aviso; las
                  promociones y cupones están sujetos a su vigencia y condiciones.</Item>
                <Item><strong>Productos:</strong> muchas fragancias son <strong>contratipos</strong>
                  (perfumes inspirados en fragancias reconocidas), <strong>no originales</strong>, salvo que
                  se indique expresamente. Los nombres de marca se usan únicamente como referencia del
                  perfil olfativo.</Item>
                <Item><strong>Disponibilidad:</strong> está sujeta a existencias y se confirma por WhatsApp
                  al momento de tomar el pedido.</Item>
                <Item><strong>Cómo se pide:</strong> agregas productos al carrito y envías el pedido por
                  WhatsApp. El pago, la entrega y demás condiciones se acuerdan de forma directa y personal
                  por ese canal en cada compra.</Item>
                <Item><strong>Tu cuenta:</strong> si te registras, eres responsable de la información y de
                  mantener la confidencialidad de tu acceso.</Item>
              </ul>
              <p>¿Dudas sobre un pedido o una promoción? Escríbenos por <Wa />.</p>
            </Seccion>

            <Seccion id="datos" icon={ShieldCheck} titulo="Tratamiento de datos personales">
              <p>
                En cumplimiento de la <strong>Ley 1581 de 2012</strong> (Habeas Data) de Colombia,
                te informamos cómo tratamos tus datos personales.
              </p>
              <ul className="space-y-2">
                <Item><strong>Responsable:</strong> {BRAND_NAME}. Canal de contacto: <Wa />.</Item>
                <Item><strong>Qué datos recolectamos:</strong> al registrarte, tu nombre, correo y teléfono;
                  al comprar, el detalle de tus pedidos e historial (necesario para el programa de fidelidad
                  y los créditos).</Item>
                <Item><strong>Para qué los usamos:</strong> procesar y coordinar tus pedidos, gestionar el
                  programa de recompensas y créditos, informarte sobre tu cuenta y brindarte atención.</Item>
                <Item><strong>No los vendemos</strong> ni los compartimos con terceros con fines comerciales.</Item>
                <Item><strong>Tus derechos:</strong> puedes conocer, actualizar, rectificar y suprimir tus
                  datos, y revocar tu consentimiento en cualquier momento, escribiéndonos por <Wa />.</Item>
                <Item><strong>Conservación:</strong> mantenemos tus datos mientras tu cuenta esté activa o
                  mientras sean necesarios para la relación comercial.</Item>
              </ul>
            </Seccion>

            <Seccion id="marcas" icon={Copyright} titulo="Marcas e imágenes">
              <p>
                Este aviso aclara el uso de imágenes y marcas en el catálogo, para que quede transparente
                tanto para clientes como para los titulares de esas marcas.
              </p>
              <ul className="space-y-2">
                <Item>Las <strong>imágenes de productos son referenciales</strong>: en su mayoría provienen
                  de fuentes públicas o de los fabricantes, y se usan solo para ilustrar el perfil de la
                  fragancia.</Item>
                <Item>Las <strong>marcas, nombres comerciales y logotipos de terceros</strong> pertenecen a
                  sus respectivos titulares. Se mencionan únicamente como <strong>referencia olfativa</strong>
                  para describir los contratipos.</Item>
                <Item>{BRAND_NAME} <strong>no está afiliada, asociada, patrocinada ni respaldada</strong> por
                  ninguna de esas marcas.</Item>
                <Item>El <strong>logotipo de {BRAND_NAME}</strong> y las imágenes propias del negocio (fotos de
                  combos y demás material que subimos) son de nuestra propiedad.</Item>
                <Item>Si eres titular de una marca o imagen y deseas que retiremos un contenido específico,
                  escríbenos por <Wa /> y lo atenderemos a la brevedad.</Item>
              </ul>
            </Seccion>
          </div>
        </div>
      </main>
    </div>
  );
}
