import { cn } from '@/lib/utils';
import { readableTextOn } from '@/lib/color';
import type { ContactoConfig, ContactoLink } from '../../domain/entities/contacto.schema';
import { getRedIcon, getRedLabel } from './redIcons';

interface Props {
  config: ContactoConfig;
  links: ContactoLink[];
  className?: string;
}

/** Fondo por defecto cuando no hay configuración guardada (marfil de la marca). */
const FONDO_DEFAULT = '#f6f3ec';

/**
 * Render compartido del "linktree" de Contáctame, dividido en dos secciones
 * semánticas que reparten el alto disponible en mitades:
 *  - superior: avatar, nombre, descripción y botones (alineable arriba o al centro)
 *  - inferior: fila de iconos de redes (alineable al centro o pegada abajo)
 * Lo usan la página pública y la vista previa en vivo del dashboard,
 * de modo que lo que el admin ve es exactamente lo que se publica.
 */
export function ContactoLinktree({ config, links, className }: Props) {
  const botones = links.filter((l) => l.tipo === 'boton');
  const redes = links.filter((l) => l.tipo === 'red');

  const esImagen = config.fondo_tipo === 'imagen' && !!config.fondo_valor;
  const fondoColor = config.fondo_tipo === 'color' ? config.fondo_valor || FONDO_DEFAULT : FONDO_DEFAULT;
  // Sobre imagen siempre texto blanco (hay velo oscuro); sobre color se calcula el contraste.
  const textColor = esImagen ? '#ffffff' : readableTextOn(fondoColor);
  const textoClaro = textColor === '#ffffff';

  return (
    <div
      className={cn('relative flex flex-col overflow-hidden', className)}
      style={esImagen ? undefined : { backgroundColor: fondoColor }}
    >
      {esImagen && (
        <>
          <img
            src={config.fondo_valor as string}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Velo con degradado sutil para que el contenido siempre sea legible */}
          <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/25 to-black/55" />
        </>
      )}

      {/* ── Sección superior (50% del alto): perfil y botones ── */}
      <section
        className={cn(
          'relative z-10 flex min-h-0 flex-1 basis-1/2 flex-col items-center',
          config.contenido_posicion === 'centro' ? 'justify-center' : 'justify-start',
        )}
        style={{ color: textColor }}
      >
        <div className="flex w-full max-w-sm flex-col items-center px-6 py-10 animate-fade-up">
          {config.avatar_url && (
            <img
              src={config.avatar_url}
              alt={config.nombre}
              className={cn(
                'size-24 rounded-full object-cover shadow-[0_12px_30px_-12px_rgb(0_0_0/0.45)] ring-2',
                textoClaro ? 'ring-white/70' : 'ring-ink/15',
              )}
            />
          )}

          <h1 className="mt-4 text-center font-display text-[26px] font-medium tracking-tight">
            {config.nombre}
          </h1>

          {config.descripcion && (
            <p className="mt-1.5 max-w-xs text-center text-[13.5px] leading-relaxed opacity-85">
              {config.descripcion}
            </p>
          )}

          {botones.length > 0 && (
            <div className="mt-8 flex w-full flex-col gap-3.5">
              {botones.map((link) => {
                const forma = link.forma ?? config.boton_forma;
                // El botón puede llevar un icono de plataforma (tiktok, instagram...) o un emoji
                const BotonIcon = link.icono ? getRedIcon(link.icono) : null;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'relative flex w-full items-center justify-center px-12 py-3.5 text-center text-[14px] font-semibold',
                      'shadow-[0_10px_28px_-14px_rgb(0_0_0/0.45)] transition-all duration-300 ease-out',
                      'hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-14px_rgb(0_0_0/0.5)]',
                      forma === 'redondo' ? 'rounded-full' : 'rounded-md',
                    )}
                    style={{
                      backgroundColor: link.color_fondo ?? config.boton_color_fondo,
                      color: link.color_texto ?? config.boton_color_texto,
                    }}
                  >
                    {BotonIcon ? (
                      <BotonIcon className="absolute left-5 size-4.5" aria-hidden="true" />
                    ) : (
                      link.emoji && (
                        <span className="absolute left-5 text-[17px] leading-none" aria-hidden="true">
                          {link.emoji}
                        </span>
                      )
                    )}
                    {link.nombre}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Sección inferior (50% del alto): redes sociales ── */}
      <section
        className={cn(
          'relative z-10 flex min-h-0 flex-1 basis-1/2 flex-col items-center',
          config.redes_posicion === 'abajo' ? 'justify-end' : 'justify-center',
        )}
        style={{ color: textColor }}
      >
        {redes.length > 0 && (
          <div className="flex max-w-sm flex-wrap items-center justify-center gap-3 px-6 py-10">
            {redes.map((red) => {
              const Icon = getRedIcon(red.nombre);
              return (
                <a
                  key={red.id}
                  href={red.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={getRedLabel(red.nombre)}
                  title={getRedLabel(red.nombre)}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border transition-all duration-300',
                    textoClaro
                      ? 'border-white/45 bg-white/10 backdrop-blur-sm hover:bg-white/25'
                      : 'border-ink/20 bg-white/60 hover:bg-white',
                  )}
                >
                  {red.emoji ? (
                    // Texto o emoji personalizado en lugar del icono de la plataforma
                    <span className="max-w-8 truncate text-[12px] font-semibold leading-none">
                      {red.emoji}
                    </span>
                  ) : (
                    <Icon className="size-4.5" />
                  )}
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
