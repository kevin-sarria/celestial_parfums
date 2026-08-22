import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Sparkles } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import TarjetaRecompensas3D from '../components/recompensas/TarjetaRecompensas3D';
import GaleriaGanadores from '../components/recompensas/GaleriaGanadores';
import SubirFotosEntrega, { type EntregaCliente } from '../components/recompensas/SubirFotosEntrega';
import { formatPrice } from '@/lib/format';
import { toast } from 'sonner';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { useAuthContext } from '../application/context/useAuthContext';
import { useMiTarjeta } from '../application/hooks/useMiTarjeta';
import { useSeo } from '../application/hooks/useSeo';

/**
 * Portal del cliente: su tarjeta de recompensas (sellos y premio). Los sellos se
 * llenan solos con cada compra pagada registrada por el negocio. Tarjeta 3D en
 * CSS puro: trazos nítidos y va suave en cualquier equipo (incl. gama baja).
 */
export default function MisRecompensasPage() {
  useSeo('Mis recompensas');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { data, loading, error } = useMiTarjeta();
  const [entregas, setEntregas] = useState<EntregaCliente[]>([]);

  const cargarEntregas = useCallback(async () => {
    const res = await http.get<{ data: EntregaCliente[] }>(urls.recompensas.misEntregas);
    if (!res.ok) toast.error(res.error, { id: 'mis-entregas' });
    setEntregas(res.cuerpo?.data ?? []);
  }, []);

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
    else cargarEntregas();
  }, [user, navigate, cargarEntregas]);

  const nombre = user ? `${user.nombre} ${user.apellido}` : '';

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Portal del cliente</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink">Mis recompensas</h1>

        {loading && !data && <PerfumeSpinner />}

        {/* Que no cargue y que no exista se ven igual en pantalla si no se
            separan: uno se arregla reintentando y el otro no. */}
        {!loading && error && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <Gift className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-[15px] text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && !data?.activo && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <Gift className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-[15px] text-muted-foreground">
              El programa de recompensas no está activo por ahora. ¡Vuelve pronto!
            </p>
          </div>
        )}

        {data?.activo && (
          <div className="mt-8 flex flex-col items-center gap-6">
            {/* Tarjeta grande: ~mitad de la pantalla en escritorio, completa en móvil */}
            <div className="w-full max-w-2xl">
              <TarjetaRecompensas3D tarjeta={data} nombre={nombre} />
            </div>

            {/* Resumen discreto bajo la tarjeta (sin recuadro) */}
            <div className="max-w-md text-center">
              {data.premio_listo ? (
                <p className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-primary">
                  <Sparkles className="size-3.5" /> ¡Tienes un premio listo! Reclámalo en tu próxima compra.
                </p>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  Llevas <strong className="font-semibold text-foreground">{data.sellos}</strong> de {data.objetivo} sellos ·
                  te {data.faltan === 1 ? 'falta' : 'faltan'} {data.faltan} para{' '}
                  <span className="text-foreground">{data.premio}</span>
                </p>
              )}
              {(data.min_compra > 0 || data.premios_entregados > 0) && (
                <p className="mt-1 text-[11.5px] text-muted-foreground/70">
                  {data.min_compra > 0 && `Cada compra desde ${formatPrice(data.min_compra)} suma un sello.`}
                  {data.premios_entregados > 0 && ` Ya ganaste ${data.premios_entregados} ${data.premios_entregados === 1 ? 'premio' : 'premios'}.`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Fotos del premio ganado (para la galería de ganadores) */}
        {entregas.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-xl font-light text-ink">Tus premios ganados 🎁</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              ¡Comparte una foto disfrutando tu premio! Aparecerás en "Nuestros ganadores".
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {entregas.map((e) => (
                <SubirFotosEntrega key={e.id} entrega={e} onSubido={cargarEntregas} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-14">
          <GaleriaGanadores />
        </div>
      </main>
    </div>
  );
}
