import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import ResenaProductoCard, { type ProductoComprado } from '../components/resenas/ResenaProductoCard';
import MisPedidos from '../components/devoluciones/MisPedidos';
import { toast } from 'sonner';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { useAuthContext } from '../application/context/useAuthContext';
import { useSeo } from '../application/hooks/useSeo';

/**
 * Portal del cliente: "Mis compras". Lista los perfumes que ya compró (ventas
 * pagadas) para que deje una reseña con estrellas, texto y hasta 3 fotos.
 */
export default function MisComprasPage() {
  useSeo('Mis compras');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [productos, setProductos] = useState<ProductoComprado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!user) navigate('/login', { replace: true }); }, [user, navigate]);

  const cargar = useCallback(async () => {
    const res = await http.get<{ data: ProductoComprado[] }>(urls.resenas.misCompras);
    // Sin esto, un fallo se ve igual que "todavía no has comprado nada".
    if (!res.ok) toast.error(res.error, { id: 'mis-compras' });
    setProductos(res.cuerpo?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Portal del cliente</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink">Mis compras</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Deja tu reseña de los perfumes que compraste. La revisamos y la publicamos en su página.
        </p>

        {loading && <PerfumeSpinner />}

        {!loading && productos.length === 0 && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <ShoppingBag className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-[15px] text-muted-foreground">
              Todavía no tienes compras registradas con Celestial Parfums.
            </p>
          </div>
        )}

        {productos.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {productos.map((p) => (
              <ResenaProductoCard key={p.id} producto={p} onGuardada={cargar} />
            ))}
          </div>
        )}

        {/* Garantía: reportar un problema con un pedido y seguir el caso */}
        {!loading && <MisPedidos />}
      </main>
    </div>
  );
}
