import { useSeo } from '../application/hooks/useSeo';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readableTextOn } from '@/lib/color';
import PerfumeSpinner from '../components/PerfumeSpinner';
import { ContactoLinktree } from '../components/contacto/ContactoLinktree';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import type { ContactoConfig, ContactoLink } from '../domain/entities/contacto.schema';

interface ContactoData {
  config: ContactoConfig;
  links: ContactoLink[];
}

/**
 * Página pública tipo linktree a pantalla completa (sin header ni footer),
 * con los enlaces de contacto y redes de la marca.
 */
export default function ContactPage() {
  const navigate = useNavigate();
  useSeo('Contáctame', 'Escríbenos por WhatsApp o encuéntranos en redes sociales.');
  const [data, setData] = useState<ContactoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await http.getCacheado<{ data?: ContactoData }>(urls.contacto.publico);
      if (!active) return;
      // El mensaje del servidor manda sobre el genérico que había aquí escrito.
      setError(res.ok ? '' : res.error);
      setData(res.cuerpo?.data ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // El botón de volver debe contrastar con el fondo elegido por el admin
  const textoClaro = data
    ? data.config.fondo_tipo === 'imagen' && !!data.config.fondo_valor
      ? true
      : readableTextOn(data.config.fondo_valor || '#f6f3ec') === '#ffffff'
    : false;

  return (
    <div className="relative min-h-svh bg-background">
      <button
        onClick={() => navigate('/')}
        aria-label="Volver al catálogo"
        title="Volver al catálogo"
        className={cn(
          'fixed left-4 top-4 z-30 flex size-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300',
          textoClaro
            ? 'border-white/40 bg-black/20 text-white hover:bg-black/40'
            : 'border-ink/15 bg-white/70 text-ink hover:bg-white',
        )}
      >
        <ArrowLeft className="size-4.5" />
      </button>

      {loading && (
        <div className="flex min-h-svh items-center justify-center">
          <PerfumeSpinner />
        </div>
      )}

      {!loading && error && (
        <div className="flex min-h-svh items-center justify-center px-5 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && data && (
        <ContactoLinktree config={data.config} links={data.links} className="min-h-svh" />
      )}
    </div>
  );
}
