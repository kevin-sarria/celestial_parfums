import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { Check, Info, TriangleAlert, X } from 'lucide-react';

/**
 * Avisos flotantes (toast) de shadcn/sonner. Se monta UNA vez en `App.tsx` y
 * cualquier vista avisa con `import { toast } from 'sonner'`.
 *
 * Sonner ya resuelve lo difícil: apilar sin superponerse, colapsar los avisos
 * viejos, deslizar para descartar, accesibilidad y animaciones. Por eso se usa
 * la librería en vez de una implementación propia — se probó una casera y se
 * descartó.
 *
 * ## Por qué NO se usa `richColors` (2026-08-11)
 *
 * Lo traía activado y el dueño lo rechazó: *"no tiene nada que ver ese estilo
 * con el resto de mi app"*. Tenía razón, y la causa es concreta: `richColors`
 * pinta con **la paleta de sonner** (verde menta, rosa saturado), que no conoce
 * el marfil ni el iris de la marca. Al lado de una pantalla sobria, el aviso
 * parecía de otra aplicación.
 *
 * Se conserva lo que `richColors` resolvía —distinguir un fallo de una
 * confirmación de un vistazo— pero con el lenguaje que la app ya usa en sus
 * bandas de aviso:
 *
 * - **El fondo es siempre marfil.** Un fondo de color grita, y aquí nada grita.
 * - **El color vive en el icono y en una franja lateral.** Basta para
 *   identificar el tipo sin teñir el mensaje.
 * - **El texto es la tinta violácea de siempre**, en Manrope, con el mismo
 *   tamaño que el resto del panel.
 *
 * Los colores por tipo son los que ya significan algo en esta app: iris para lo
 * bueno (es la marca), rojo para lo que falló, ámbar para lo que hay que mirar.
 */

/** Redondo con el icono dentro: el mismo recurso que usan las tarjetas. */
const Icono = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${className}`}>
    {children}
  </span>
);

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      // Máximo 3 a la vista: los demás se apilan colapsados detrás
      visibleToasts={3}
      duration={5000}
      closeButton
      icons={{
        success: <Icono className="bg-brand-soft text-primary"><Check className="size-3.5" /></Icono>,
        error: <Icono className="bg-destructive/10 text-destructive"><TriangleAlert className="size-3.5" /></Icono>,
        warning: <Icono className="bg-amber-100 text-amber-700"><TriangleAlert className="size-3.5" /></Icono>,
        info: <Icono className="bg-secondary text-muted-foreground"><Info className="size-3.5" /></Icono>,
        loading: <Icono className="bg-secondary text-muted-foreground"><Info className="size-3.5 animate-pulse" /></Icono>,
      }}
      toastOptions={{
        classNames: {
          // `!` porque sonner trae sus propios colores en variables y aquí
          // manda el tema de la app, no el de la librería
          // `!items-start` y `!text-left`: sonner centra el contenido, y con un
          // mensaje de varias líneas —los del servidor lo son— queda ilegible,
          // con el icono flotando a media altura. Se comprobó en pantalla.
          /**
           * El padding lleva `!` porque **sonner impone `padding: 16px`** y sin
           * la marca de prioridad gana la librería. Se descubrió midiendo: el
           * `paddingRight` computado seguía siendo 16px y en los mensajes
           * largos del servidor el texto pasaba POR DEBAJO del aspa — 22px de
           * solape. A ojo parecía que "casi se tocan"; el número dijo que se
           * montaban.
           *
           * `!pr-12` (48px) = 14 de margen + 24 del botón + 10 de aire.
           */
          toast: 'group !items-start gap-3 rounded-xl border !border-border !bg-card !p-3.5 !pr-12 '
            + 'font-sans !text-foreground !text-left shadow-[0_12px_32px_-12px_rgb(0_0_0/0.28)] '
            + 'border-l-4 !border-l-border',
          title: 'text-[13.5px] font-medium leading-snug !text-foreground !text-left',
          description: 'mt-0.5 text-[12.5px] leading-snug !text-muted-foreground !text-left',
          icon: 'mt-0.5 !self-start',
          // La franja lateral es lo único que cambia de color según el tipo
          success: '!border-l-primary',
          error: '!border-l-destructive',
          warning: '!border-l-amber-400',
          info: '!border-l-border',
          actionButton: 'rounded-md !bg-primary px-2.5 !text-primary-foreground text-[12px] font-medium',
          cancelButton: 'rounded-md !bg-secondary px-2.5 !text-secondary-foreground text-[12px]',
          /**
           * DENTRO de la caja, arriba a la derecha.
           *
           * Sonner la saca a medias por fuera del borde, como una insignia
           * pegada. Lo señaló el dueño: *"esa x afuera se ve muy forzada"*. En
           * una estética sobria un botón mordiendo el borde se lee como un
           * defecto de maquetación, no como un detalle.
           */
          /**
           * `!transform-none` es la clave y costó una medición.
           *
           * Sonner posiciona el aspa con `transform: translate(-35%, -35%)`
           * para sacarla A MEDIAS por fuera del borde, como una insignia. Las
           * utilidades `translate-*` de Tailwind v4 no lo anulan (escriben otra
           * propiedad), así que el aspa se quedaba 8px arriba y 8px a la
           * derecha de donde decía el código: medido, 5px del borde superior
           * cuando el contenido respeta 14, y 11px desalineada del texto.
           *
           * Con el transform apagado, `top/right-3.5` la deja en la MISMA
           * rejilla de 14px que todo lo demás.
           */
          closeButton: '!transform-none !left-auto !right-3.5 !top-3.5 '
            + '!size-6 !rounded-md !border-transparent !bg-transparent !text-muted-foreground '
            + 'hover:!border-border hover:!bg-secondary hover:!text-foreground',
        },
      }}
      {...props}
    />
  );
}

/** Se exporta el aspa por si alguna vista arma un toast propio y la necesita. */
export { X as IconoCerrarToast };
