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
      <div className="space-y-4">{children}</div>
      {footerEl}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-h-[88svh] overflow-y-auto sm:max-w-135"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {onSubmit ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            {inner}
          </form>
        ) : (
          inner
        )}
      </DialogContent>
    </Dialog>
  );
}
