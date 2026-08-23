import { useSeo } from '../application/hooks/useSeo';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import PerfumeCard from '../components/PerfumeCard';
import { Chip } from '../components/catalog/FilterChips';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { useAuthContext } from '../application/context/useAuthContext';
import {
  usePerfumeIdeal, filtrosVacios,
  type FiltrosIdeal, type RecomendacionGuardada,
} from '../application/hooks/usePerfumeIdeal';

interface Lookup { id: number; nombre: string }

type Fase = 'cargando' | 'intro' | 'quiz' | 'analizando' | 'resultados';

const TOTAL_PASOS = 7;

const EDADES = ['18-25', '26-35', '36-50', '50+'] as const;

const PRESUPUESTOS: { valor: number | null; label: string }[] = [
  { valor: 50000, label: 'Hasta $50.000' },
  { valor: 100000, label: 'Hasta $100.000' },
  { valor: 150000, label: 'Hasta $150.000' },
  { valor: 200000, label: 'Hasta $200.000' },
  { valor: null, label: 'Sin límite' },
];

const LINEAS_ANALISIS = [
  'Leyendo tu perfil olfativo…',
  'Cruzando tus notas favoritas con todo el catálogo…',
  'Midiendo la afinidad de cada perfume contigo…',
  'Puliendo tus recomendaciones…',
];

/** Tarjeta grande de opción única (género, intensidad). */
function OpcionCard({ activa, titulo, detalle, emoji, onClick }: {
  activa: boolean; titulo: string; detalle?: string; emoji: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-5 text-center transition-all duration-200',
        activa
          ? 'border-primary bg-brand-soft shadow-sm'
          : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/40',
      )}
    >
      <span className="text-2xl">{emoji}</span>
      <span className={cn('text-[14.5px] font-semibold', activa ? 'text-primary' : 'text-foreground')}>{titulo}</span>
      {detalle && <span className="text-[12px] leading-snug text-muted-foreground">{detalle}</span>}
    </button>
  );
}

/**
 * "Tu perfume ideal" (solo cuentas registradas): quiz por pasos que calcula las
 * mejores recomendaciones según ocasiones, notas, edad, presupuesto y más.
 * El resultado queda guardado en la cuenta: al volver NO se recalcula.
 */
export default function PerfumeIdealPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  useSeo('Tu perfume ideal', 'Responde unas preguntas y descubre los perfumes que mejor te quedan.');
  const { guardada, loading, calcular } = usePerfumeIdeal();

  const [fase, setFase] = useState<Fase>('cargando');
  const [paso, setPaso] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosIdeal>(filtrosVacios());
  const [resultado, setResultado] = useState<RecomendacionGuardada | null>(null);
  const [lineaAnalisis, setLineaAnalisis] = useState(0);
  const [error, setError] = useState('');

  // Solo para usuarios registrados correctamente
  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  // Al entrar: si ya hay un cálculo guardado se muestra tal cual (sin recalcular)
  useEffect(() => {
    if (loading || fase !== 'cargando') return;
    if (guardada) { setResultado(guardada); setFiltros({ ...filtrosVacios(), ...guardada.filtros }); setFase('resultados'); }
    else setFase('intro');
  }, [loading, guardada, fase]);

  // Catálogo de opciones del quiz (lo que realmente existe en la base de datos)
  const [ocasiones, setOcasiones] = useState<Lookup[]>([]);
  const [aromas, setAromas] = useState<Lookup[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  useEffect(() => {
    let vivo = true;
    (async () => {
      // Cacheados: son las mismas tres listas que ya pide el catálogo, así que
      // llegando desde ahí no viaja ninguna petición.
      const [o, a, c] = await Promise.all([
        http.getCacheado<{ data?: Lookup[] }>(urls.clasificaciones('ocasiones').lista),
        http.getCacheado<{ data?: Lookup[] }>(urls.clasificaciones('tipos-aroma').lista),
        http.getCacheado<{ data?: Lookup[] }>(urls.clasificaciones('categorias').lista),
      ]);
      if (!vivo) return;
      // Sin listas el quiz queda sin opciones que marcar, pero avanza igual:
      // todas sus preguntas son opcionales y el cálculo las tolera vacías.
      setOcasiones(o.cuerpo?.data ?? []);
      setAromas(a.cuerpo?.data ?? []);
      setCategorias(c.cuerpo?.data ?? []);
    })();
    return () => { vivo = false; };
  }, []);

  // Frases rotando durante el "análisis"
  useEffect(() => {
    if (fase !== 'analizando') return;
    setLineaAnalisis(0);
    const t = setInterval(() => setLineaAnalisis((i) => (i + 1) % LINEAS_ANALISIS.length), 950);
    return () => clearInterval(t);
  }, [fase]);

  const toggle = (campo: 'ocasiones' | 'aromas' | 'categorias', id: number) =>
    setFiltros((f) => ({
      ...f,
      [campo]: f[campo].includes(id) ? f[campo].filter((x) => x !== id) : [...f[campo], id],
    }));

  const analizar = async () => {
    setFase('analizando'); setError('');
    try {
      // El "análisis" dura unos segundos aunque el cálculo sea inmediato: da
      // tiempo a leer y hace tangible que se armó un perfil a su medida.
      const [data] = await Promise.all([
        calcular(filtros),
        new Promise((r) => setTimeout(r, 3400)),
      ]);
      setResultado(data);
      setFase('resultados');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo calcular, intenta de nuevo');
      setFase('quiz'); setPaso(TOTAL_PASOS - 1);
    }
  };

  const siguiente = () => (paso < TOTAL_PASOS - 1 ? setPaso(paso + 1) : analizar());
  // Salir del quiz sin terminarlo: si ya hay un cálculo guardado se vuelve a él
  // (no a la portada), y sus respuestas quedan como estaban.
  const atras = () => {
    if (paso > 0) { setPaso(paso - 1); return; }
    if (resultado) { setFiltros({ ...filtrosVacios(), ...resultado.filtros }); setFase('resultados'); }
    else setFase('intro');
  };

  /** true si el paso actual tiene alguna respuesta (cambia "Omitir" por "Siguiente"). */
  const pasoRespondido = [
    filtros.genero !== null,
    filtros.edad !== null,
    filtros.ocasiones.length > 0,
    filtros.aromas.length > 0,
    filtros.intensidad !== null,
    filtros.categorias.length > 0,
    filtros.presupuesto !== null,
  ][paso];

  // Resumen legible de las respuestas (para la pantalla de resultados)
  const resumen = useMemo(() => {
    if (!resultado) return [];
    const f = { ...filtrosVacios(), ...resultado.filtros };
    const nombreDe = (lista: Lookup[], ids: number[]) =>
      ids.map((id) => lista.find((x) => x.id === id)?.nombre).filter(Boolean) as string[];
    const chips: string[] = [];
    if (f.genero) chips.push(f.genero === 'dama' ? 'Para ella' : f.genero === 'caballero' ? 'Para él' : 'Unisex');
    if (f.edad) chips.push(`${f.edad} años`);
    chips.push(...nombreDe(ocasiones, f.ocasiones));
    chips.push(...nombreDe(aromas, f.aromas));
    if (f.intensidad) chips.push(`Proyección ${f.intensidad}`);
    chips.push(...nombreDe(categorias, f.categorias));
    if (f.presupuesto) chips.push(`Hasta ${formatPrice(f.presupuesto)}`);
    return chips;
  }, [resultado, ocasiones, aromas, categorias]);

  const kicker = (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
      <Sparkles className="size-3.5" /> Tu perfume ideal
    </p>
  );

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-10 md:px-8">
        {fase === 'cargando' && <PerfumeSpinner />}

        {/* ── Portada ── */}
        {fase === 'intro' && (
          <div className="animate-fade-up pt-8 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-soft">
              <Sparkles className="size-7 text-primary" />
            </span>
            <h1 className="mt-6 font-display text-4xl font-light tracking-tight text-ink md:text-5xl">
              Encuentra tu perfume ideal
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Respóndeme {TOTAL_PASOS} preguntas rápidas sobre tus gustos y ocasiones,
              y armo tu perfil olfativo para recomendarte los perfumes del catálogo
              que mejor te quedan. Puedes saltarte las que quieras.
            </p>
            <Button className="mt-8 h-12 rounded-full px-8 text-[15px]" onClick={() => { setPaso(0); setFase('quiz'); }}>
              Comenzar <ArrowRight className="size-4" />
            </Button>
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              {TOTAL_PASOS} preguntas · menos de 1 minuto · se guarda en tu cuenta
            </p>
          </div>
        )}

        {/* ── Quiz por pasos ── */}
        {fase === 'quiz' && (
          <div key={paso} className="animate-fade-up pt-4">
            {kicker}
            {/* Progreso */}
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${((paso + 1) / TOTAL_PASOS) * 100}%` }}
                />
              </div>
              <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                {paso + 1}/{TOTAL_PASOS}
              </span>
            </div>

            {paso === 0 && (
              <>
                <h2 className="mt-8 font-display text-3xl font-light tracking-tight text-ink">¿Para quién buscamos?</h2>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <OpcionCard emoji="🌸" titulo="Para ella" activa={filtros.genero === 'dama'} onClick={() => setFiltros(f => ({ ...f, genero: f.genero === 'dama' ? null : 'dama' }))} />
                  <OpcionCard emoji="🤵" titulo="Para él" activa={filtros.genero === 'caballero'} onClick={() => setFiltros(f => ({ ...f, genero: f.genero === 'caballero' ? null : 'caballero' }))} />
                  <OpcionCard emoji="✨" titulo="Unisex" activa={filtros.genero === 'unisex'} onClick={() => setFiltros(f => ({ ...f, genero: f.genero === 'unisex' ? null : 'unisex' }))} />
                  <OpcionCard emoji="🎁" titulo="Sorpréndeme" detalle="cualquiera me sirve" activa={filtros.genero === null} onClick={() => setFiltros(f => ({ ...f, genero: null }))} />
                </div>
              </>
            )}

            {paso === 1 && (
              <>
                <h2 className="mt-8 font-display text-3xl font-light tracking-tight text-ink">¿Qué edad tiene quien lo va a llevar?</h2>
                <p className="mt-2 text-[13.5px] text-muted-foreground">Cada etapa tiene sus notas: me ayuda a afinar el estilo.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {EDADES.map((e) => (
                    <Chip key={e} active={filtros.edad === e} onClick={() => setFiltros(f => ({ ...f, edad: f.edad === e ? null : e }))}>
                      {e} años
                    </Chip>
                  ))}
                  <Chip active={filtros.edad === null} onClick={() => setFiltros(f => ({ ...f, edad: null }))}>
                    Prefiero no decirlo
                  </Chip>
                </div>
              </>
            )}

            {paso === 2 && (
              <>
                <h2 className="mt-8 font-display text-3xl font-light tracking-tight text-ink">¿Para qué ocasiones lo quieres?</h2>
                <p className="mt-2 text-[13.5px] text-muted-foreground">Elige todas las que apliquen.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {ocasiones.map((o) => (
                    <Chip key={o.id} active={filtros.ocasiones.includes(o.id)} onClick={() => toggle('ocasiones', o.id)}>
                      {o.nombre}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {paso === 3 && (
              <>
                <h2 className="mt-8 font-display text-3xl font-light tracking-tight text-ink">¿Qué notas te enamoran?</h2>
                <p className="mt-2 text-[13.5px] text-muted-foreground">Los aromas que quieres sentir al destapar el frasco.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {aromas.map((a) => (
                    <Chip key={a.id} active={filtros.aromas.includes(a.id)} onClick={() => toggle('aromas', a.id)}>
                      {a.nombre}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {paso === 4 && (
              <>
                <h2 className="mt-8 font-display text-3xl font-light tracking-tight text-ink">¿Qué tanto quieres que se note?</h2>
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <OpcionCard emoji="🕊️" titulo="Discreto" detalle="un susurro cerca de la piel" activa={filtros.intensidad === 'suave'} onClick={() => setFiltros(f => ({ ...f, intensidad: f.intensidad === 'suave' ? null : 'suave' }))} />
                  <OpcionCard emoji="🌿" titulo="Equilibrado" detalle="presente sin invadir" activa={filtros.intensidad === 'media'} onClick={() => setFiltros(f => ({ ...f, intensidad: f.intensidad === 'media' ? null : 'media' }))} />
                  <OpcionCard emoji="🔥" titulo="Que se sienta" detalle="deja estela al pasar" activa={filtros.intensidad === 'fuerte'} onClick={() => setFiltros(f => ({ ...f, intensidad: f.intensidad === 'fuerte' ? null : 'fuerte' }))} />
                </div>
              </>
            )}

            {paso === 5 && (
              <>
                <h2 className="mt-8 font-display text-3xl font-light tracking-tight text-ink">¿Qué tipo de perfume prefieres?</h2>
                <p className="mt-2 text-[13.5px] text-muted-foreground">Si no marcas ninguno, considero todos.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {categorias.map((c) => (
                    <Chip key={c.id} active={filtros.categorias.includes(c.id)} onClick={() => toggle('categorias', c.id)}>
                      {c.nombre}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {paso === 6 && (
              <>
                <h2 className="mt-8 font-display text-3xl font-light tracking-tight text-ink">¿Cuál es tu presupuesto?</h2>
                <div className="mt-6 flex flex-wrap gap-2">
                  {PRESUPUESTOS.map((p) => (
                    <Chip key={p.label} active={filtros.presupuesto === p.valor} onClick={() => setFiltros(f => ({ ...f, presupuesto: p.valor }))}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
                {error && <p className="mt-4 text-[13px] font-medium text-destructive">{error}</p>}
              </>
            )}

            {/* Navegación */}
            <div className="mt-10 flex items-center justify-between">
              <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={atras}>
                <ArrowLeft className="size-4" /> {paso === 0 && resultado ? 'Mis resultados' : 'Atrás'}
              </Button>
              <Button className="h-11 rounded-full px-7" onClick={siguiente}>
                {paso === TOTAL_PASOS - 1
                  ? <>Descubrir mis perfumes <Sparkles className="size-4" /></>
                  : pasoRespondido ? <>Siguiente <ArrowRight className="size-4" /></> : 'Omitir'}
              </Button>
            </div>
          </div>
        )}

        {/* ── "Análisis" ── */}
        {fase === 'analizando' && (
          <div className="flex flex-col items-center pt-16 text-center">
            <PerfumeSpinner />
            <p key={lineaAnalisis} className="animate-fade-up mt-6 font-display text-xl font-light text-ink">
              {LINEAS_ANALISIS[lineaAnalisis]}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Comparando tu perfil con cada perfume del catálogo
            </p>
          </div>
        )}

        {/* ── Resultados guardados ── */}
        {fase === 'resultados' && resultado && (
          <div className="animate-fade-up">
            {kicker}
            <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink">
              Tus {resultado.items.length} perfumes con más afinidad
            </h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              Calculado el {new Date(resultado.calculado_en).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} ·
              guardado en tu cuenta: al volver lo verás tal cual, sin repetir el quiz.
            </p>

            {resumen.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tu perfil</span>
                {resumen.map((r) => (
                  <span key={r} className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-primary">{r}</span>
                ))}
              </div>
            )}

            {resultado.items.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-[14px] text-muted-foreground">
                No encontré perfumes que encajen con esas respuestas. Ajusta tus filtros e inténtalo de nuevo.
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resultado.items.map((p, i) => (
                  <div key={p.id} className="flex flex-col">
                    <div className="relative">
                      {/* Afinidad calculada con sus respuestas */}
                      <span className="pointer-events-none absolute -right-2 -top-2 z-10 rounded-full bg-primary px-2.5 py-1 text-[11.5px] font-bold text-primary-foreground shadow-md">
                        {p.puntaje}% afín
                      </span>
                      {i === 0 && (
                        <span className="pointer-events-none absolute -left-2 -top-2 z-10 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                          Tu match nº1
                        </span>
                      )}
                      <PerfumeCard perfume={p} />
                    </div>
                    {p.razones.length > 0 && (
                      <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
                        {p.razones.slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 text-center">
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => { setPaso(0); setError(''); setFase('quiz'); }}
              >
                <RotateCcw className="size-4" /> Ajustar mis respuestas
              </Button>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Solo se recalcula si terminas el quiz de nuevo.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
