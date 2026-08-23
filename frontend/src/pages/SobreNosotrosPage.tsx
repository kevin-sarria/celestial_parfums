import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import { toast } from 'sonner';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
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
    (async () => {
      const res = await http.getCacheado<{ data: Config | null }>(urls.nosotros.publico);
      // Al home solo se va si el servidor confirma que la página no está configurada.
      // Un fallo de red no es lo mismo, y echar al visitante lo hacía parecer igual.
      if (res.ok && !res.cuerpo?.data) { navigate('/', { replace: true }); return; }
      if (!res.ok) toast.error(res.error, { id: 'nosotros' });
      setCfg(res.cuerpo?.data ?? null);
      setCargando(false);
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-10 md:px-8 animate-fade-up">
        {cargando ? (
          <PerfumeSpinner />
        ) : !cfg ? (
          <p className="mt-10 text-center text-[15px] text-muted-foreground">
            No pudimos cargar esta página. Revisa tu conexión y vuelve a intentarlo.
          </p>
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
