import { useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { Check, Gift, RotateCcw, Sparkles } from 'lucide-react';
import { BRAND_ICON_SRC } from '../BrandMark';
import type { MiTarjeta } from '../../application/hooks/useMiTarjeta';

interface Props {
  tarjeta: MiTarjeta;
  nombre: string;
}

/** Foil metálico: una franja de luz cruzando el color elegido. */
const foil = (c: string) => `linear-gradient(135deg, ${c}, ${c} 38%, #ffffffb3 50%, ${c} 62%, ${c})`;
/** Fondo con un leve degradado desde el color hacia negro (da profundidad). */
const fondoGrad = (c: string) => `radial-gradient(120% 120% at 22% 0%, ${c} 0%, ${c} 48%, #000000 140%)`;

/**
 * Tarjeta de recompensas en 3D con CSS puro (base para todos los dispositivos):
 * se inclina siguiendo el dedo/mouse, tiene brillo que se mueve y se voltea para
 * ver el reverso. Colores configurables y tamaño proporcional (unidades cqw/em).
 * Ligera y suave hasta en gama baja. El ancho lo define el contenedor padre.
 */
export default function TarjetaRecompensas3D({ tarjeta, nombre }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 0, on: false });
  const [volteada, setVolteada] = useState(false);

  const onMove = (e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setRot({ x: (0.5 - py) * 14, y: (px - 0.5) * 16 });
    setGlare({ x: px * 100, y: py * 100, on: true });
  };
  const onLeave = () => { setRot({ x: 0, y: 0 }); setGlare(g => ({ ...g, on: false })); };

  const { objetivo, sellos, premio, faltan, premio_listo, premios_listos, colores } = tarjeta;
  const c = colores;

  return (
    // El contenedor establece el "container query context": así `cqw` de la
    // tarjeta se mide contra SU ancho (no contra la ventana) y el texto escala bien.
    <div className="flex w-full flex-col items-center gap-4" style={{ perspective: '1400px', containerType: 'inline-size' }}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        // fontSize anclado al ancho (cqw): todo el contenido va en `em` y escala junto
        className="relative aspect-[1.66/1] w-full cursor-pointer transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x}deg) rotateY(${(volteada ? 180 : 0) + rot.y}deg)`,
          fontSize: 'clamp(11px, 3.05cqw, 21px)',
        }}
        onClick={() => setVolteada(v => !v)}
        role="button"
        aria-label="Girar la tarjeta"
      >
        {/* ── FRENTE ── */}
        <Cara fondo={c.fondo}>
          <Borde lineas={c.lineas} />
          <Diagonales lineas={c.lineas} />
          {glare.on && <Brillo x={glare.x} y={glare.y} />}

          <div className="relative flex h-full flex-col items-center justify-between text-center" style={{ padding: '1.4em' }}>
            <div className="flex flex-col items-center" style={{ gap: '0.4em' }}>
              <img src={BRAND_ICON_SRC} alt="" className="object-contain"
                style={{ height: '3em', width: '3em', filter: 'brightness(0) invert(1)' }} />
              <div className="leading-none">
                <p className="font-display font-medium" style={{ fontSize: '1.4em', letterSpacing: '0.3em', color: c.texto }}>CELESTIAL</p>
                <p className="font-semibold" style={{ marginTop: '0.35em', fontSize: '0.72em', letterSpacing: '0.5em', ...textoFoil(c.lineas) }}>PARFUMS</p>
              </div>
              <p className="uppercase" style={{ marginTop: '0.3em', fontSize: '0.72em', letterSpacing: '0.28em', color: c.texto, opacity: 0.5 }}>Tarjeta de premios</p>
            </div>

            <Sellos objetivo={objetivo} llenos={sellos} lineas={c.lineas} />

            {premio_listo ? (
              <p className="flex items-center font-semibold" style={{ gap: '0.4em', fontSize: '0.95em', ...textoFoil(c.lineas) }}>
                <Sparkles style={{ width: '1.1em', height: '1.1em' }} /> ¡PREMIO LISTO{premios_listos > 1 ? ` ×${premios_listos}` : ''}!
              </p>
            ) : (
              <p style={{ fontSize: '0.85em', color: c.texto, opacity: 0.78 }}>
                Te {faltan === 1 ? 'falta' : 'faltan'} <strong style={{ fontWeight: 800 }}>{faltan}</strong>{' '}
                {faltan === 1 ? 'sello' : 'sellos'} para tu premio
              </p>
            )}
          </div>
        </Cara>

        {/* ── REVERSO ── */}
        <Cara fondo={c.fondo} volteada>
          <Borde lineas={c.lineas} />
          <div className="relative flex h-full flex-col items-center justify-center text-center" style={{ gap: '0.8em', padding: '1.6em' }}>
            <Gift style={{ width: '2em', height: '2em', color: c.lineas }} />
            <div>
              <p className="uppercase" style={{ fontSize: '0.72em', letterSpacing: '0.28em', color: c.texto, opacity: 0.5 }}>Tu premio al completar</p>
              <p className="font-display font-medium leading-snug" style={{ marginTop: '0.35em', fontSize: '1.4em', color: c.texto }}>{premio}</p>
            </div>
            <p className="leading-relaxed" style={{ maxWidth: '20em', fontSize: '0.8em', color: c.texto, opacity: 0.6 }}>
              Junta {objetivo} sellos comprando en Celestial Parfums. Cada compra registrada suma un sello
              automáticamente. ¡Y al llenarla, empiezas otra!
            </p>
            <p style={{ fontSize: '0.72em', letterSpacing: '0.2em', color: c.texto, opacity: 0.4 }}>{nombre.toUpperCase()}</p>
          </div>
        </Cara>
      </div>

      <button
        type="button"
        onClick={() => setVolteada(v => !v)}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <RotateCcw className="size-3.5" /> {volteada ? 'Ver los sellos' : 'Ver el premio'}
      </button>
    </div>
  );
}

/** Texto pintado con el foil del color de líneas. */
const textoFoil = (lineas: string): CSSProperties => ({
  background: foil(lineas), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
});

/** Una cara de la tarjeta (frente o reverso volteado 180°). */
function Cara({ children, fondo, volteada = false }: { children: React.ReactNode; fondo: string; volteada?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-2xl shadow-[0_30px_60px_-25px_rgba(0,0,0,0.7)]"
      style={{ background: fondoGrad(fondo), backfaceVisibility: 'hidden', transform: volteada ? 'rotateY(180deg)' : undefined }}
    >
      {children}
    </div>
  );
}

/** Marco fino de la tarjeta con el color de líneas. */
function Borde({ lineas }: { lineas: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-2xl"
      style={{ padding: 1.5, background: foil(lineas), WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }}
    />
  );
}

/** Cintas diagonales en las esquinas, como la tarjeta impresa. */
function Diagonales({ lineas }: { lineas: string }) {
  const g = foil(lineas);
  return (
    <>
      <div className="pointer-events-none absolute -right-10 -top-3 h-6 w-56 rotate-[32deg]" style={{ background: g }} />
      <div className="pointer-events-none absolute -right-12 top-1 h-1.5 w-52 rotate-[32deg]" style={{ background: g, opacity: 0.7 }} />
      <div className="pointer-events-none absolute -bottom-3 -left-10 h-6 w-56 rotate-[32deg]" style={{ background: g }} />
      <div className="pointer-events-none absolute -left-12 bottom-1 h-1.5 w-52 rotate-[32deg]" style={{ background: g, opacity: 0.7 }} />
    </>
  );
}

/** Reflejo que sigue al puntero. */
function Brillo({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity"
      style={{ background: `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.28), rgba(255,255,255,0) 42%)` }}
    />
  );
}

/** Fila de sellos: llenos con el color de líneas + check, vacíos con borde punteado. */
function Sellos({ objetivo, llenos, lineas }: { objetivo: number; llenos: number; lineas: string }) {
  return (
    <div className="flex max-w-full flex-wrap items-center justify-center" style={{ gap: '0.6em' }}>
      {Array.from({ length: objetivo }).map((_, i) => {
        const lleno = i < llenos;
        return (
          <div
            key={i}
            className="flex items-center justify-center rounded-full font-semibold"
            style={
              lleno
                ? { width: '2.3em', height: '2.3em', background: foil(lineas), color: '#1a140a', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }
                : { width: '2.3em', height: '2.3em', fontSize: '0.85em', border: `0.09em dashed ${lineas}`, opacity: 0.55, color: lineas }
            }
          >
            {lleno ? <Check style={{ width: '1.1em', height: '1.1em' }} strokeWidth={3} /> : i + 1}
          </div>
        );
      })}
    </div>
  );
}
