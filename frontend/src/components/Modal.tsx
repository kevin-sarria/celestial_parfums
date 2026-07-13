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
 * Mantiene la API histórica (onSubmit envuelve el contenido en <form>,
 * footer permite reemplazar las acciones por defecto).
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
      <DialogHeader>
        <DialogTitle className="font-display text-lg font-medium">{title}</DialogTitle>
      </DialogHeader>
      <div className="min-w-0 space-y-4">{children}</div>
      {footerEl}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        // min-w-0 en los hijos permite que el contenido (tablas, etc.) se encoja
        // en pantallas pequeñas en vez de desbordar el modal
        className="max-h-[88svh] overflow-y-auto overflow-x-hidden p-4 sm:max-w-135 sm:p-6"
        // min() evita que un maxWidth grande desborde la pantalla en ventanas angostas
        style={maxWidth ? { maxWidth: `min(${maxWidth}px, calc(100vw - 2rem))` } : undefined}
      >
        {onSubmit ? (
          <form className="min-w-0 space-y-4" onSubmit={onSubmit}>
            {inner}
          </form>
        ) : (
          inner
        )}
      </DialogContent>
    </Dialog>
  );
}
