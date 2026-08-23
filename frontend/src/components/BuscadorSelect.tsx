import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useIdDeCampo, useIdDeEtiqueta } from './ui/campoEtiqueta';
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
  /**
   * Ids que CIERRAN el panel al elegirse, aunque esté en modo "agregar varios".
   *
   * Es para las opciones que no agregan nada a la lista sino que abren otra
   * cosa —"+ Crear insumo nuevo" despliega un formulario justo debajo— y que
   * con el panel abierto quedaría tapado por la propia lista.
   */
  cierranPanel?: (number | string)[];
  /**
   * Mostrar la caja de búsqueda. Por defecto solo con **6 opciones o más**.
   *
   * Es el mismo corte que ya usaba el proyecto para decidir entre desplegable
   * nativo y buscador: con tres opciones fijas (unidad, género, modo de IVA) el
   * buscador estorba más de lo que ayuda. Al unificar TODOS los desplegables en
   * este componente, la regla se conserva escondiendo el buscador en vez de
   * cambiando de componente — así el aspecto es siempre el mismo.
   */
  conBuscador?: boolean;
  /**
   * Clases del CONTENEDOR, no del botón — igual que hacía el select nativo al
   * que reemplaza. De ahí salen el ancho y el alto del campo, y también la
   * medida con la que se dibuja el panel: puestas en el botón, el botón se
   * encogía pero la caja y la lista seguían midiendo el ancho completo.
   */
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/** Alto máximo del panel (buscador + lista), aire respecto al campo y al borde. */
const ALTO_PANEL = 246;
const MARGEN = 4;
const AIRE_BORDE = 12;
/** A partir de cuántas opciones aparece la caja de búsqueda. */
const MINIMO_PARA_BUSCAR = 6;

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
  cierranPanel,
  conBuscador,
  className,
  id,
  'aria-label': ariaLabel,
}: Props) {
  // El botón es el control del campo: `<label htmlFor>` puede apuntarle porque
  // un <button> sí admite etiqueta (a diferencia de un <div> con role).
  const idBoton = useIdDeCampo(id);
  // "Esencia, Sin asignar" en vez de solo "Esencia": ver `useIdDeEtiqueta`.
  const idEtiqueta = useIdDeEtiqueta();
  const citaEtiqueta = !ariaLabel && idEtiqueta ? `${idEtiqueta} ${idBoton}` : undefined;
  const esSelector = value !== undefined;
  // Con pocas opciones la caja de búsqueda sobra: se leen todas de un vistazo.
  const buscador = conBuscador ?? opciones.length >= MINIMO_PARA_BUSCAR;
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [resaltada, setResaltada] = useState(0);
  const contRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState({ top: 0, left: 0, width: 0, alto: ALTO_PANEL, arriba: false });
  /**
   * Dónde se cuelga el panel: dentro del diálogo si lo hay, si no en el <body>.
   *
   * **Dentro de un modal tiene que ser el diálogo, y no es cosmético.** Radix
   * atrapa el foco dentro del diálogo: colgando del <body>, al escribir en el
   * buscador Radix devolvía el foco al campo anterior y las letras se iban ahí
   * — en un recorrido el nombre del cliente quedó guardado como
   * "Cliente del recorridoVentas 1".
   *
   * Se resuelve al ABRIR, en el manejador del clic, y no en un efecto
   * posterior: React agrupa ese `setState` con el de abrir, así que el panel ya
   * nace en su sitio definitivo. Calculado después, se montaba primero en el
   * <body> y se remontaba en el diálogo — y al remontarse el campo de búsqueda
   * es otro nodo del DOM, así que el foco se perdía: justo el fallo que esto
   * venía a arreglar.
   */
  const [anfitrion, setAnfitrion] = useState<HTMLElement | null>(null);

  /** Abre el panel dejando resuelto de quién va a colgar. */
  const abrir = () => {
    setAnfitrion(contRef.current?.closest<HTMLElement>('[data-slot="dialog-content"]') ?? null);
    setAbierto(true);
  };

  const seleccionada = esSelector
    ? opciones.find((o) => String(o.id) === String(value ?? ''))
    : undefined;

  const filtradas = useMemo(() => {
    const q = normalizar(texto.trim());
    if (!q) return opciones;
    return opciones.filter((o) => normalizar(o.nombre).includes(q));
  }, [opciones, texto]);

  /**
   * Dónde pintar el panel, en coordenadas de pantalla.
   *
   * Se calcula a mano porque el panel se pinta FUERA del formulario (ver el
   * portal, más abajo) y por tanto ya no puede colocarse solo respecto al campo.
   */
  const recolocar = useCallback(() => {
    const r = contRef.current?.getBoundingClientRect();
    if (!r) return;
    // Colgado del diálogo, las coordenadas van respecto a ÉL, no a la pantalla.
    const dialogo = contRef.current?.closest<HTMLElement>('[data-slot="dialog-content"]');
    const origen = dialogo?.getBoundingClientRect();
    const dx = origen?.left ?? 0;
    const dy = origen?.top ?? 0;

    // El alto se ACOTA al hueco disponible en vez de fiarse de una constante:
    // así el panel nunca se sale de la pantalla ni queda pegado al borde, y la
    // lista scrollea por dentro. Fijar un alto "que suele caber" es lo que deja
    // el último renglón cortado en las pantallas bajas.
    const abajo = window.innerHeight - r.bottom - MARGEN - AIRE_BORDE;
    const arriba = r.top - MARGEN - AIRE_BORDE;
    // Se despliega hacia arriba solo si abajo no cabe y arriba se ve más.
    const haciaArriba = abajo < ALTO_PANEL && arriba > abajo;

    setCaja({
      top: (haciaArriba ? r.top - MARGEN : r.bottom + MARGEN) - dy,
      left: r.left - dx,
      width: r.width,
      alto: Math.max(120, Math.min(ALTO_PANEL, haciaArriba ? arriba : abajo)),
      arriba: haciaArriba,
    });
  }, []);

  // Al abrir: colocar el panel y poner el foco en el buscador
  useEffect(() => {
    if (abierto) {
      setTexto('');
      setResaltada(0);
      recolocar();
      // Sin buscador el foco va al panel: si no, las flechas y Enter no
      // tendrían dónde escucharse y el desplegable quedaría solo para ratón.
      (buscador ? inputRef.current : panelRef.current)?.focus();
    }
  }, [abierto, buscador, recolocar]);

  /**
   * Mientras está abierto, el panel sigue al campo.
   *
   * El `true` del listener es lo que importa: captura el scroll de CUALQUIER
   * contenedor, no solo el de la ventana. Sin eso, al desplazar un modal el
   * campo se movería y el panel se quedaría flotando en su sitio.
   */
  useEffect(() => {
    if (!abierto) return;
    window.addEventListener('scroll', recolocar, true);
    window.addEventListener('resize', recolocar);
    return () => {
      window.removeEventListener('scroll', recolocar, true);
      window.removeEventListener('resize', recolocar);
    };
  }, [abierto, recolocar]);

  // Clic fuera: se cierra. El panel cuenta como "dentro" aunque viva en otra
  // parte del documento — si no, elegir una opción lo cerraría antes de tiempo.
  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: PointerEvent) => {
      const destino = e.target as Node;
      if (contRef.current?.contains(destino) || panelRef.current?.contains(destino)) return;
      setAbierto(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [abierto]);

  const elegir = (id: number | string) => {
    onSelect(id);
    if (esSelector || cierranPanel?.some((c) => String(c) === String(id))) {
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
      // Dentro de un modal, quien impide que Escape cierre el formulario
      // entero es `Modal` (Radix lo escucha en captura y desde aquí no se puede
      // parar). Aquí solo se cierra el desplegable.
      setAbierto(false);
    }
  };

  return (
    <div ref={contRef} className={cn('relative h-9 w-full', className)}>
      {/* Disparador con la apariencia exacta de SelectSimple */}
      <button
        type="button"
        id={idBoton}
        aria-label={ariaLabel}
        aria-labelledby={citaEtiqueta}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={cn(
          // El alto sale del CONTENEDOR (`h-full`), nunca fijo aquí: con `h-9`
          // propio, una pantalla que pedía un campo bajo (`h-8`) se quedaba con
          // el botón de 36px dentro de una caja de 32px. El botón sobresalía 4px
          // y, como el panel se coloca desde el borde inferior del contenedor,
          // se abría PEGADO al campo (1px de aire en vez de 4).
          'h-full w-full cursor-pointer rounded-md border border-input bg-card px-3 pr-8 text-left',
          'text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          seleccionada ? 'text-foreground' : 'text-muted-foreground',
        )}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            abrir();
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

      {abierto && createPortal(
        /**
         * El panel se pinta en el `<body>`, no aquí dentro.
         *
         * Dentro del formulario era un `absolute`, y en un modal —que tiene su
         * propio scroll— eso lo dejaba RECORTADO por el borde del modal: la
         * lista se veía a medias y había que desplazar el formulario entero
         * para leerla. Sacándolo al documento flota por encima de todo, que es
         * como se comporta un desplegable de verdad.
         *
         * A cambio hay que colocarlo a mano (`recolocar`) y contarlo como
         * "dentro" al detectar el clic fuera.
         */
        <div
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={buscador ? undefined : onKeyDown}
          // Por encima de CUALQUIER cosa que lo contenga: un modal (z-50), el
          // popover de filtro de una columna o el tooltip de la tabla (los dos
          // en z-100). Con z-60 el desplegable que vive DENTRO del filtro de
          // "Referencia" se abría tapado por el propio recuadro del filtro:
          // se veía la lista pero no se podía tocar ninguna opción.
          className="z-[110] flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-lg outline-none"
          style={{
            // `absolute` dentro del diálogo (que ya es su bloque contenedor) y
            // `fixed` cuando cuelga del documento.
            position: anfitrion ? 'absolute' : 'fixed',
            top: caja.top,
            left: caja.left,
            width: caja.width,
            maxHeight: caja.alto,
            // Desplegado hacia arriba: se ancla por abajo para que crezca en
            // esa dirección sin taparle el campo al usuario.
            transform: caja.arriba ? 'translateY(-100%)' : undefined,
            // IMPRESCINDIBLE dentro de un modal: mientras hay un diálogo abierto,
            // Radix apaga los clics de todo lo que cuelga del <body> fuera de él.
            // Como el panel vive ahí, se VEÍA pero no se podía tocar: las opciones
            // no respondían al clic. Se descubrió porque los recorridos empezaron
            // a reintentar el clic hasta agotar el tiempo.
            pointerEvents: 'auto',
          }}
        >
          {/* El buscador vive dentro del panel, y solo si hay bastante que filtrar */}
          {buscador && (
          <div className="relative shrink-0 border-b border-border/70">
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
          )}

          {/* Ocupa el hueco que quede: si el panel se achica por falta de sitio,
              es la lista la que scrollea, no el buscador el que desaparece. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-1" role="listbox">
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
        </div>,
        anfitrion ?? document.body,
      )}
    </div>
  );
}
