import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, HandCoins } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePortalCredito } from '../application/hooks/usePortalCredito';
import { useAuthContext } from '../application/context/useAuthContext';
import { useSeo } from '../application/hooks/useSeo';

const fmtFecha = (d: string) =>
  new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Portal del cliente: consulta de SU crédito (deuda y cuotas pagadas).
 * Los créditos los otorga únicamente el administrador desde el dashboard.
 */
export default function MiCreditoPage() {
  useSeo('Mi crédito');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { data, loading } = usePortalCredito();

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  const creditos = data?.creditos ?? [];

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Portal del cliente</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink">Mi crédito</h1>

        {loading && !data && <PerfumeSpinner />}

        {!loading && creditos.length === 0 && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <HandCoins className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-[15px] text-muted-foreground">
              No tienes créditos registrados con Celestial Parfums.
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground/80">
              Si crees que es un error, escríbenos y revisamos tu cuenta.
            </p>
          </div>
        )}

        {creditos.length > 0 && (
          <>
            {/* Resumen de deuda */}
            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Deuda total actual
              </p>
              <p className="mt-1 font-display text-3xl font-medium text-primary">
                {formatPrice(data?.deuda_total ?? 0)}
              </p>
            </div>

            {/* Créditos con sus cuotas pagadas */}
            <section className="mt-8 flex flex-col gap-5">
              {creditos.map((c) => {
                const progreso = c.deuda_inicial > 0 ? Math.min(100, (c.abonado / c.deuda_inicial) * 100) : 100;
                return (
                  <article key={c.id} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                          <CalendarDays className="size-3.5" /> {fmtFecha(c.fecha)}
                        </p>
                        <p className="mt-1 text-[15px] font-medium text-foreground">{c.articulos}</p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-3 py-1 text-[11.5px] font-semibold',
                          c.saldo > 0
                            ? 'border-amber-200 bg-amber-50 text-amber-600'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-600',
                        )}
                      >
                        {c.saldo > 0 ? `Debes ${formatPrice(c.saldo)}` : 'Pagado'}
                      </span>
                    </div>

                    {/* Barra de progreso del pago */}
                    <div className="mt-4">
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progreso}%` }} />
                      </div>
                      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                        Has pagado {formatPrice(c.abonado)} de {formatPrice(c.deuda_inicial)}
                      </p>
                    </div>

                    {c.abonos.length > 0 && (
                      <div className="mt-4 border-t border-border/70 pt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Cuotas pagadas ({c.abonos.length})
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {c.abonos.map((a, i) => (
                            <li key={i} className="flex items-center justify-between text-[13.5px]">
                              <span className="text-muted-foreground">{fmtFecha(a.fecha)}</span>
                              <span className="font-medium text-foreground">{formatPrice(a.monto)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
