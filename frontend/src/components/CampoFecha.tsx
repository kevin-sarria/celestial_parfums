import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hoy } from '../utils/fechas';
import {
  dentroDe, fechaLegible, leerFecha, mesLegible, moverDias, moverMeses, semanasDelMes,
} from '../utils/calendario';
import { useIdDeCampo, useIdDeEtiqueta } from './ui/campoEtiqueta';
import { CAPA_PANEL, usePanelAnclado } from './panelAnclado';

/** Ancho y alto del calendario: 7 casillas de 36 px (el dedo) más el aire. */
const ANCHO = 288;
const ALTO = 360;
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  /** 'AAAA-MM-DD', o '' si no hay fecha. */
  value: string;
  /**
   * Con la misma forma que el `onChange` de un `<input>` (`e.target.value`):
   * así reemplaza a los `<Input type="date">` sin tocar sus manejadores.
   */
  onChange: (e: { target: { value: string } }) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Selector de fecha de la aplicación.
 *
 * Reemplaza al `<input type="date">` del navegador. El dueño, el 2026-09-28, con
 * captura de su celular: *"estamos usando el básico de html que se ve feo, eso
 * debería cambiarse"*. Es la misma decisión que se tomó con los `<select>`
 * (ver `SelectSimple`): cerrado se veía bien, pero al abrirlo aparecía el
 * control del sistema operativo, distinto en cada teléfono y fuera del estilo.
 *
 * Se coloca con `usePanelAnclado`, como el desplegable, y guarda la fecha en el
 * mismo formato que el input ('AAAA-MM-DD'), así que el servidor no nota nada.
 */
export function CampoFecha({
  value, onChange, min, max, required, disabled, placeholder = 'Elegir fecha', className, id,
  'aria-label': ariaLabel,
}: Props) {
  const idBoton = useIdDeCampo(id);
  const idEtiqueta = useIdDeEtiqueta();
  const { contRef, panelRef, abierto, abrir, cerrar, estiloPanel, destino } = usePanelAnclado({ alto: ALTO, ancho: ANCHO });
  const botonRef = useRef<HTMLButtonElement>(null);

  /** El día con el foco del teclado; el mes que se ve sale de él. */
  const [foco, setFoco] = useState(value || hoy());
  useEffect(() => { if (abierto) setFoco(value || hoy()); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  // El foco entra al día marcado al abrir, para que las flechas funcionen de una
  useEffect(() => {
    if (abierto) panelRef.current?.querySelector<HTMLButtonElement>('[data-foco="true"]')?.focus();
  }, [abierto, foco, panelRef]);

  const f = leerFecha(foco) ?? leerFecha(hoy())!;
  const hoyTxt = hoy();

  const elegir = (dia: string) => {
    if (!dentroDe(dia, min, max)) return;
    onChange({ target: { value: dia } });
    cerrar();
    botonRef.current?.focus();
  };

  const teclas = (e: React.KeyboardEvent) => {
    const mover: Record<string, () => string> = {
      ArrowLeft: () => moverDias(foco, -1),
      ArrowRight: () => moverDias(foco, 1),
      ArrowUp: () => moverDias(foco, -7),
      ArrowDown: () => moverDias(foco, 7),
      PageUp: () => moverMeses(foco, -1),
      PageDown: () => moverMeses(foco, 1),
    };
    if (mover[e.key]) { e.preventDefault(); setFoco(mover[e.key]()); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(foco); }
    // Dentro de un modal, quien evita que Escape cierre el formulario es `Modal`
    else if (e.key === 'Escape') { cerrar(); botonRef.current?.focus(); }
  };

  return (
    <div ref={contRef} className={cn('relative h-9 w-full', className)}>
      <button
        ref={botonRef}
        type="button"
        id={idBoton}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && idEtiqueta ? `${idEtiqueta} ${idBoton}` : undefined}
        aria-haspopup="dialog"
        // Para los recorridos: el valor que un botón no expone como un input
        data-valor={value}
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : abrir())}
        // Mismo aspecto que `BuscadorSelect` y que `Input`: 16 px en el celular
        // (con menos, Safari del iPhone acerca la pantalla).
        className={cn(
          'flex h-full w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-left',
          'text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          value ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{value ? fechaLegible(value) : placeholder}</span>
      </button>
      {/* El navegador sigue exigiendo la fecha al enviar el formulario: un
          botón no participa en la validación, este campo oculto sí. */}
      {required && (
        <input
          tabIndex={-1} aria-hidden required value={value} onChange={() => {}}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}

      {abierto && createPortal(
        <div
          ref={panelRef}
          data-panel-flotante
          role="dialog"
          aria-label="Elegir fecha"
          onKeyDown={teclas}
          className={cn(CAPA_PANEL, 'overflow-hidden rounded-lg border border-border bg-card p-2.5 shadow-lg')}
          style={estiloPanel}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <button type="button" aria-label="Mes anterior" onClick={() => setFoco(moverMeses(foco, -1))}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-brand-soft hover:text-primary">
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display text-[15px] font-medium text-foreground" aria-live="polite">
              {mesLegible(f.anio, f.mes)}
            </span>
            <button type="button" aria-label="Mes siguiente" onClick={() => setFoco(moverMeses(foco, 1))}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-brand-soft hover:text-primary">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div role="grid" aria-label={mesLegible(f.anio, f.mes)} data-mes={foco.slice(0, 7)}>
            <div role="row" className="grid grid-cols-7">
              {DIAS_SEMANA.map((d, i) => (
                <span key={i} role="columnheader" className="grid h-7 place-items-center text-[11px] font-semibold text-muted-foreground">
                  {d}
                </span>
              ))}
            </div>
            {semanasDelMes(f.anio, f.mes).map((semana) => (
              <div key={semana[0]} role="row" className="grid grid-cols-7">
                {semana.map((dia) => {
                  const delMes = Number(dia.slice(5, 7)) === f.mes;
                  const elegido = dia === value;
                  const permitido = dentroDe(dia, min, max);
                  return (
                    <button
                      key={dia}
                      type="button"
                      role="gridcell"
                      aria-selected={elegido}
                      aria-label={fechaLegible(dia)}
                      disabled={!permitido}
                      data-foco={dia === foco}
                      data-dia={dia}
                      tabIndex={dia === foco ? 0 : -1}
                      onClick={() => elegir(dia)}
                      className={cn(
                        'm-auto grid size-9 place-items-center rounded-md text-[13.5px] tabular-nums transition-colors',
                        !delMes && 'text-muted-foreground/45',
                        elegido
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : 'hover:bg-brand-soft hover:text-primary',
                        dia === hoyTxt && !elegido && 'font-semibold text-primary ring-1 ring-primary/40',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:pointer-events-none disabled:opacity-30',
                      )}
                    >
                      {Number(dia.slice(8, 10))}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-1.5 flex items-center justify-between border-t border-border pt-2">
            <button type="button" onClick={() => elegir(hoyTxt)} disabled={!dentroDe(hoyTxt, min, max)}
              className="h-8 rounded-md px-2.5 text-[13px] font-medium text-primary hover:bg-brand-soft disabled:opacity-40">
              Hoy
            </button>
            {!required && value && (
              <button type="button" onClick={() => { onChange({ target: { value: '' } }); cerrar(); }}
                className="h-8 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-secondary">
                Quitar fecha
              </button>
            )}
          </div>
        </div>,
        destino(),
      )}
    </div>
  );
}
