import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeCard from '../components/PerfumeCard';
import CardSkeleton from '../components/CardSkeleton';
import CartFab from '../components/CartFab';
import WhatsAppFab from '../components/WhatsAppFab';
import type { Perfume } from '../domain/entities/perfume.schema';
import { BASE_URL, authFetchWithRefresh } from '../infrastructure/api/client';
import { useAuthContext } from '../application/context/useAuthContext';
import { useListas } from '../application/context/ListasContext';
import { useSeo } from '../application/hooks/useSeo';

/** Portal del cliente: los perfumes que guardó como favoritos. */
export default function MisFavoritosPage() {
  useSeo('Mis favoritos');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { favoritos } = useListas();
  const [items, setItems] = useState<Perfume[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    setLoading(true);
    authFetchWithRefresh(`${BASE_URL}/api/favoritos/detalle`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setItems(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    cargar();
  }, [user, navigate, cargar]);

  // Al quitar un favorito desde una card, refresca la lista (sale de la vista)
  const visibles = items.filter((p) => favoritos.has(p.id));

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Portal del cliente</p>
        <h1 className="mt-2 flex items-center gap-2.5 font-display text-4xl font-light tracking-tight text-ink">
          <Heart className="size-7 fill-primary text-primary" /> Mis favoritos
        </h1>

        {loading ? (
          <div className="mt-8 grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
            <CardSkeleton count={4} />
          </div>
        ) : visibles.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-10 text-center">
            <Heart className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-[15px] text-muted-foreground">
              Aún no tienes favoritos. Toca el corazón de un perfume para guardarlo aquí.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 justify-center gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]">
            {visibles.map((p) => (
              <PerfumeCard key={p.id} perfume={p} />
            ))}
          </div>
        )}
      </main>
      <WhatsAppFab />
      <CartFab />
    </div>
  );
}
