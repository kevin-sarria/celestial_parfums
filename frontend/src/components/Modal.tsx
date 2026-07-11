import { useEffect, type ReactNode, type FormEvent } from 'react';
import { FiX } from 'react-icons/fi';
import '../styles/modal.css';

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const header = (
    <div className="dash-modal-header">
      <h3>{title}</h3>
      <button type="button" className="dash-modal-close" onClick={onClose}>
        <FiX />
      </button>
    </div>
  );

  const body = <div className="dash-modal-body">{children}</div>;

  const defaultFooter = (
    <div className="dash-modal-footer">
      <button type="button" className="dash-btn-ghost" onClick={onClose}>
        {cancelLabel}
      </button>
      <button
        type={onSubmit ? 'submit' : 'button'}
        className="dash-btn-accent"
        disabled={loading}
      >
        {submitLabel}
      </button>
    </div>
  );

  const footerEl = footer !== undefined ? footer : defaultFooter;

  return (
    <div className="dash-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="dash-modal"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={e => e.stopPropagation()}
      >
        {onSubmit ? (
          <form className="dash-modal-inner" onSubmit={onSubmit}>
            {header}
            {body}
            {footerEl}
          </form>
        ) : (
          <div className="dash-modal-inner">
            {header}
            {body}
            {footerEl}
          </div>
        )}
      </div>
    </div>
  );
}
