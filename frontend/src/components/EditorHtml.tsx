import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link2, Pilcrow } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  const [pidiendoUrl, setPidiendoUrl] = useState(false);
  const [url, setUrl] = useState('');
  /**
   * Lo que estaba seleccionado cuando se pulsó "Enlace".
   *
   * Al escribir en la casilla el foco se va del área editable y **el navegador
   * pierde la selección**, así que `createLink` no tendría a qué aplicarse. Se
   * guarda el rango antes y se devuelve justo antes de crear el enlace.
   */
  const seleccion = useRef<Range | null>(null);

  // Solo se pinta el valor inicial una vez (re-escribir innerHTML mueve el cursor)
  useEffect(() => {
    if (ref.current && !iniciado.current) {
      ref.current.innerHTML = value || '';
      iniciado.current = true;
    }
  }, [value]);

  const emitir = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); ref.current?.focus(); emitir(); };
  /**
   * Se pide la URL en la propia pantalla y no con `window.prompt`: aquel abre
   * una ventana gris del sistema operativo en medio de un diseño marfil e iris,
   * y además congela la página entera mientras está abierta.
   */
  const abrirEnlace = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      toast.error('Primero marca el texto que quieres enlazar', { id: 'enlace' });
      return;
    }
    seleccion.current = sel.getRangeAt(0).cloneRange();
    setUrl('');
    setPidiendoUrl(true);
  };

  const cerrarEnlace = () => { setPidiendoUrl(false); seleccion.current = null; };

  const ponerEnlace = () => {
    const limpia = url.trim();
    if (!limpia) { toast.error('Escribe la dirección del enlace', { id: 'enlace' }); return; }
    const rango = seleccion.current;
    if (!rango) { cerrarEnlace(); return; }
    // Se devuelve la selección al texto ANTES de crear el enlace.
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(rango);
    // Sin esquema, el navegador arma un enlace relativo a la tienda y el
    // visitante acaba en una página que no existe.
    exec('createLink', /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`);
    cerrarEnlace();
  };

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
        <Btn title="Enlace" onClick={abrirEnlace}><Link2 className="size-4" /></Btn>
      </div>

      {pidiendoUrl && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-soft/40 px-2 py-2">
          <Input
            autoFocus
            value={url}
            placeholder="celestialparfums.com/blog"
            aria-label="Dirección del enlace"
            className="h-8 w-full min-w-40 flex-1 sm:w-auto"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); ponerEnlace(); }
              if (e.key === 'Escape') { e.preventDefault(); cerrarEnlace(); }
            }}
          />
          <Button type="button" size="sm" className="h-8" onClick={ponerEnlace}>Poner enlace</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={cerrarEnlace}>Cancelar</Button>
        </div>
      )}
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
