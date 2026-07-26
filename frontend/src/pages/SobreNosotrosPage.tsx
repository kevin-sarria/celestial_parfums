import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import { BASE_URL } from '../infrastructure/api/client';
import { fetchJsonCached } from '../infrastructure/api/cachedFetch';
import { useSeo } from '../application/hooks/useSeo';

interface Config {
  titulo: string;
  historia: string;
  imagen: string | null;
}

/** Página pública "Sobre nosotros" (contenido configurable desde el dashboard). */
export default function SobreNosotrosPage() {
  useSeo('Sobre nosotros', 'Conoce la historia de Celestial Parfums.');
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetchJsonCached<{ data: Config | null }>(`${BASE_URL}/api/nosotros`)
      .then((j) => { if (!j.data) { navigate('/', { replace: true }); return; } setCfg(j.data); })
      .catch(() => navigate('/', { replace: true }))
      .finally(() => setCargando(false));
  }, [navigate]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-10 md:px-8 animate-fade-up">
        {cargando || !cfg ? (
          <PerfumeSpinner />
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Celestial Parfums</p>
            <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink md:text-5xl">{cfg.titulo}</h1>
            {cfg.imagen && (
              <img src={cfg.imagen} alt={cfg.titulo} loading="lazy" decoding="async"
                className="mt-8 aspect-[16/10] w-full rounded-3xl border border-border object-cover" />
            )}
            <div className="mt-8 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
              {cfg.historia}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
