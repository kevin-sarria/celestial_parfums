import { type ReactNode, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  maxWidth?: number;
}

/**
 * Modal de formulario del dashboard sobre shadcn Dialog.
 *
 * **Encabezado y pie ANCLADOS; solo el centro se desplaza.** Antes el
 * `overflow-y-auto` estaba en el modal entero, así que al bajar por un
 * formulario largo se iban con el contenido el título, el botón de cerrar y los
 * botones de guardar: quedabas a media pantalla sin saber qué estabas editando
 * ni cómo salir, y había que subir hasta arriba o bajar hasta el fondo para
 * cada acción. Lo señaló el dueño el 2026-08-13 con una captura del formulario
 * de perfume.
 *
 * El arreglo vive AQUÍ y no en cada pantalla: lo usan 25 modales y ninguno tuvo
 * que cambiar.
 *
 * Mantiene la API histórica: `onSubmit` envuelve el contenido en un `<form>` y
 * `footer` permite reemplazar las acciones por defecto (o quitarlas con `null`).
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  onSubmit,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  loading = false,
  maxWidth,
}: ModalProps) {
  const defaultFooter = (
    <DialogFooter className="gap-2">
      <Button type="button" variant="ghost" onClick={onClose}>
        {cancelLabel}
      </Button>
      <Button type={onSubmit ? 'submit' : 'button'} disabled={loading}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );

  const footerEl = footer !== undefined ? footer : defaultFooter;

  const inner = (
    <>
      {/* Encabezado fijo. El `pr-10` deja sitio a la X, que shadcn coloca en la
          esquina: sin él, un título largo pasa por debajo del icono. */}
      <DialogHeader className="shrink-0 rounded-t-lg border-b border-border bg-background px-4 py-3.5 sm:px-6">
        <DialogTitle className="pr-10 font-display text-lg font-medium">{title}</DialogTitle>
      </DialogHeader>

      {/* Lo único que se desplaza. `min-h-0` es imprescindible: sin él un hijo
          flex se niega a encogerse por debajo de su contenido y el scroll se
          va otra vez al modal entero, deshaciendo todo esto. */}
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
        {children}
      </div>

      {/* Pie fijo. El envoltorio pone el borde y el margen para que los 14
          modales que traen su propio footer se vean igual que los demás. */}
      {footerEl != null && (
        <div className="shrink-0 rounded-b-lg border-t border-border bg-background px-4 py-3.5 sm:px-6">
          {footerEl}
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        // El modal ya NO scrollea: es una columna de tres piezas y el hueco
        // sobrante se lo lleva el contenido. `gap-0` y `p-0` anulan los del
        // Dialog base, porque ahora el espaciado lo pone cada pieza.
        // Sin `overflow-hidden`: el desplegable de la aplicación se cuelga del
        // diálogo (para no perder el foco que Radix atrapa) y tiene que poder
        // salirse de su borde. Quien recorta es el cuerpo, que es el que scrollea.
        className="flex max-h-[88svh] flex-col gap-0 p-0 sm:max-w-135"
        // min() evita que un maxWidth grande desborde la pantalla en ventanas angostas
        style={maxWidth ? { maxWidth: `min(${maxWidth}px, calc(100vw - 2rem))` } : undefined}
        /**
         * Con un desplegable abierto, Escape lo cierra a ÉL y no al formulario.
         *
         * Radix escucha Escape en fase de CAPTURA, o sea antes que cualquier
         * hijo, así que el desplegable no puede pararlo por su cuenta: el
         * formulario entero se cerraba y se perdía lo escrito. Aquí sí se puede
         * decirle a Radix que no actúe.
         */
        onEscapeKeyDown={(e) => {
          if (document.querySelector('[role="listbox"]')) e.preventDefault();
        }}
      >
        {onSubmit ? (
          // El <form> tiene que ser la columna, no un envoltorio suelto: si no,
          // el botón de guardar del pie quedaría fuera del formulario.
          <form className="flex min-h-0 flex-col" onSubmit={onSubmit}>
            {inner}
          </form>
        ) : (
          inner
        )}
      </DialogContent>
    </Dialog>
  );
}
