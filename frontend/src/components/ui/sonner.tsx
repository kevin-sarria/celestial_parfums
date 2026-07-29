import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Avisos flotantes (toast) de shadcn/sonner. Se monta UNA vez en `App.tsx` y
 * cualquier vista avisa con `import { toast } from 'sonner'`.
 *
 * Sonner ya resuelve lo difícil: apilar sin superponerse, colapsar los avisos
 * viejos, deslizar para descartar, accesibilidad y animaciones. Por eso se usa
 * la librería en vez de una implementación propia.
 *
 * Tematizado con la paleta del proyecto (marfil + iris) vía CSS variables.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      // Máximo 3 a la vista: los demás se apilan colapsados detrás
      visibleToasts={3}
      duration={5000}
      closeButton
      // richColors: el error se ve rojo y el éxito verde de un vistazo. Sin esto
      // todos salen blancos y un fallo no se distingue de una confirmación.
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-xl font-sans shadow-[0_12px_32px_-12px_rgb(0_0_0/0.28)]',
          title: 'text-[13.5px] font-medium leading-snug',
          description: 'text-[12.5px]',
        },
      }}
      {...props}
    />
  );
}
