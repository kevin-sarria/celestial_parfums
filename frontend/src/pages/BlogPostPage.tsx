import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import { BASE_URL } from '../infrastructure/api/client';
import { fetchJsonCached } from '../infrastructure/api/cachedFetch';
import { useSeo } from '../application/hooks/useSeo';

interface Post {
  titulo: string;
  contenido: string;
  portada: string | null;
  fecha: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

/** Entrada del blog. El HTML ya viene SANEADO del backend (seguro de inyectar). */
export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [cargando, setCargando] = useState(true);
  useSeo(post?.titulo ?? 'Blog');

  useEffect(() => {
    fetchJsonCached<{ data: Post | null }>(`${BASE_URL}/api/blog/${slug}`)
      .then((j) => { if (!j.data) { navigate('/blog', { replace: true }); return; } setPost(j.data); })
      .catch(() => navigate('/blog', { replace: true }))
      .finally(() => setCargando(false));
  }, [slug, navigate]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-8 md:px-8 animate-fade-up">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Volver al blog
        </Link>

        {cargando || !post ? (
          <PerfumeSpinner />
        ) : (
          <article className="mt-6">
            <p className="text-[12px] text-muted-foreground">{fmt(post.fecha)}</p>
            <h1 className="mt-2 font-display text-4xl font-light leading-tight tracking-tight text-ink">{post.titulo}</h1>
            {post.portada && (
              <img src={post.portada} alt={post.titulo} decoding="async"
                className="mt-6 aspect-[16/9] w-full rounded-3xl border border-border object-cover" />
            )}
            {/* Contenido saneado en el servidor (sanitize-html): seguro de inyectar. */}
            <div className="blog-contenido mt-8" dangerouslySetInnerHTML={{ __html: post.contenido }} />
          </article>
        )}
      </main>
    </div>
  );
}
