import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcionBuscador {
  id: number | string;
  nombre: string;
}

interface Props {
  opciones: OpcionBuscador[];
  placeholder?: string;
  onSelect: (id: number | string) => void;
  /**
   * Con `value` definido actúa como selector de valor único (el campo muestra
   * la opción elegida); sin él es un "agregar a la lista" que permanece
   * abierto para elegir varias opciones seguidas.
   */
  value?: number | string | null;
  disabled?: boolean;
  /** Mensaje cuando no hay coincidencias. */
  vacio?: string;
}

/** Búsqueda sin tildes ni mayúsculas: "rose" encuentra "212 VIP Rosé". */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Reemplazo de <select> para listas largas, con el patrón combobox clásico:
 * el campo se ve como un select normal (muestra lo elegido) y el buscador
 * vive DENTRO del panel desplegado. La lista tiene alto acotado y scrollea
 * por dentro, nunca expande el formulario.
 */
export default function BuscadorSelect({
  opciones,
  placeholder = 'Seleccionar…',
  onSelect,
  value,
  disabled,
  vacio = 'Sin coincidencias',
}: Props) {
  const esSelector = value !== undefined;
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [resaltada, setResaltada] = useState(0);
  const contRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionada = esSelector
    ? opciones.find((o) => String(o.id) === String(value ?? ''))
    : undefined;

  const filtradas = useMemo(() => {
    const q = normalizar(texto.trim());
    if (!q) return opciones;
    return opciones.filter((o) => normalizar(o.nombre).includes(q));
  }, [opciones, texto]);

  // Al abrir: foco directo en el buscador del panel
  useEffect(() => {
    if (abierto) {
      setTexto('');
      setResaltada(0);
      inputRef.current?.focus();
    }
  }, [abierto]);

  // Clic fuera del componente: se cierra
  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: PointerEvent) => {
      if (!contRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [abierto]);

  const elegir = (id: number | string) => {
    onSelect(id);
    if (esSelector) {
      setAbierto(false);
    } else {
      // Modo "agregar": sigue abierto para encadenar elecciones
      setTexto('');
      setResaltada(0);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltada((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltada((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtradas[resaltada]) elegir(filtradas[resaltada].id);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div ref={contRef} className="relative w-full">
      {/* Disparador con la apariencia exacta de NativeSelect */}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={cn(
          'h-9 w-full cursor-pointer rounded-md border border-input bg-card px-3 pr-8 text-left',
          'text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          seleccionada ? 'text-foreground' : 'text-muted-foreground',
        )}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setAbierto(true);
          }
        }}
      >
        <span className="block truncate">{seleccionada?.nombre ?? placeholder}</span>
      </button>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform',
          abierto && 'rotate-180',
        )}
      />

      {abierto && (
        // left/right en línea: si `inset-x-0` no aplica, el panel se encogería
        // al ancho del texto más largo y quedaría desalineado del campo.
        <div
          className="absolute z-50 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-lg"
          style={{ left: 0, right: 0, width: '100%' }}
        >
          {/* El buscador vive dentro del panel */}
          <div className="relative border-b border-border/70">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={texto}
              placeholder="Escribe para filtrar…"
              style={{ paddingLeft: '2.25rem' }}
              className="h-9 w-full bg-transparent pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(e) => { setTexto(e.target.value); setResaltada(0); }}
              onKeyDown={onKeyDown}
            />
          </div>

          <div className="overflow-y-auto p-1" style={{ maxHeight: '12.5rem' }} role="listbox">
            {filtradas.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-muted-foreground">{vacio}</p>
            ) : (
              filtradas.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={esSelector && String(o.id) === String(value ?? '')}
                  className={cn(
                    'block w-full rounded py-1.5 pr-2.5 text-left text-sm text-foreground transition-colors',
                    i === resaltada ? 'bg-brand-soft text-primary' : 'hover:bg-brand-soft hover:text-primary',
                    esSelector && String(o.id) === String(value ?? '') && 'font-medium text-primary',
                  )}
                  // Mismo margen que el texto del buscador: todo alineado en una columna
                  style={{ paddingLeft: '2.25rem' }}
                  // onMouseDown corre antes que el blur del buscador: el clic no se pierde
                  onMouseDown={(e) => { e.preventDefault(); elegir(o.id); }}
                  onMouseEnter={() => setResaltada(i)}
                >
                  {o.nombre}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
