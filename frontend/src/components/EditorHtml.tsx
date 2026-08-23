import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link2, Pilcrow } from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
}

/**
 * Un botón de la barra de herramientas.
 *
 * Vive FUERA del editor a propósito. Declarado dentro, en cada render era una
 * función nueva y React desmontaba y volvía a montar los ocho botones con cada
 * tecla que se escribiera. Es la regla del proyecto que más caro sale cuando se
 * cuela en un formulario —ahí se pierde el foco y lo que el usuario estaba
 * escribiendo—, y aquí no hacía falta romperla: el botón no usa nada del
 * editor, solo lo que recibe por props.
 */
function Btn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      // onMouseDown+preventDefault: no roba el foco/selección al área editable
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

/**
 * Editor de texto enriquecido ligero (contentEditable + toolbar), sin dependencia
 * externa. El HTML resultante SIEMPRE se sanea en el backend antes de guardar
 * (sanitize-html), así que no se confía en lo que produzca el navegador.
 */
export default function EditorHtml({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const iniciado = useRef(false);

  // Solo se pinta el valor inicial una vez (re-escribir innerHTML mueve el cursor)
  useEffect(() => {
    if (ref.current && !iniciado.current) {
      ref.current.innerHTML = value || '';
      iniciado.current = true;
    }
  }, [value]);

  const emitir = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); ref.current?.focus(); emitir(); };
  const enlace = () => { const url = window.prompt('URL del enlace (https://…):'); if (url) exec('createLink', url); };

  return (
    <div className="overflow-hidden rounded-md border border-input bg-card shadow-xs">
      <div className="flex flex-wrap gap-0.5 border-b border-border bg-secondary/30 p-1.5">
        <Btn title="Negrita" onClick={() => exec('bold')}><Bold className="size-4" /></Btn>
        <Btn title="Cursiva" onClick={() => exec('italic')}><Italic className="size-4" /></Btn>
        <span className="mx-1 w-px bg-border" />
        <Btn title="Título" onClick={() => exec('formatBlock', 'h2')}><Heading2 className="size-4" /></Btn>
        <Btn title="Subtítulo" onClick={() => exec('formatBlock', 'h3')}><Heading3 className="size-4" /></Btn>
        <Btn title="Párrafo" onClick={() => exec('formatBlock', 'p')}><Pilcrow className="size-4" /></Btn>
        <span className="mx-1 w-px bg-border" />
        <Btn title="Lista" onClick={() => exec('insertUnorderedList')}><List className="size-4" /></Btn>
        <Btn title="Lista numerada" onClick={() => exec('insertOrderedList')}><ListOrdered className="size-4" /></Btn>
        <Btn title="Enlace" onClick={enlace}><Link2 className="size-4" /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={emitir}
        role="textbox"
        aria-multiline="true"
        className="blog-contenido max-h-[45vh] min-h-48 overflow-y-auto p-3 text-[14px] leading-relaxed focus:outline-none"
      />
    </div>
  );
}
