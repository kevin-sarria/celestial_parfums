import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import { toast } from 'sonner';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { useSeo } from '../application/hooks/useSeo';

interface PostLista {
  slug: string;
  titulo: string;
  resumen: string;
  portada: string | null;
  fecha: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

/** Blog público: lista de entradas publicadas. */
export default function BlogPage() {
  useSeo('Blog', 'Consejos y novedades de perfumería de Celestial Parfums.');
  const [posts, setPosts] = useState<PostLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await http.getCacheado<{ data?: PostLista[] }>(urls.blog.publico(1, 24));
      // Callar aquí prometería "pronto publicaremos" cuando la verdad es que no cargó.
      if (!res.ok) toast.error(res.error, { id: 'blog-lista' });
      setFallo(!res.ok);
      setPosts(res.cuerpo?.data ?? []);
      setCargando(false);
    })();
  }, []);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Celestial Parfums</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink">Blog</h1>

        {cargando ? (
          <PerfumeSpinner />
        ) : posts.length === 0 ? (
          <p className="mt-10 text-center text-[15px] text-muted-foreground">
            {fallo
              ? 'No pudimos cargar el blog. Revisa tu conexión y vuelve a intentarlo.'
              : 'Pronto publicaremos contenido aquí.'}
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.slug} to={`/blog/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-[0_20px_45px_-20px_rgb(0_0_0/0.18)]">
                {p.portada ? (
                  <img src={p.portada} alt={p.titulo} loading="lazy" decoding="async"
                    className="aspect-[16/10] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-secondary/50">
                    <span className="font-display text-4xl italic text-muted-foreground/40">𝒫</span>
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="text-[11.5px] text-muted-foreground">{fmt(p.fecha)}</p>
                  <h2 className="font-display text-[19px] font-medium leading-snug text-ink group-hover:text-primary">{p.titulo}</h2>
                  {p.resumen && <p className="line-clamp-3 text-[13.5px] leading-relaxed text-muted-foreground">{p.resumen}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
