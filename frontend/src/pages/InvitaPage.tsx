import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Users, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CatalogHeader from '../components/CatalogHeader';
import PerfumeSpinner from '../components/PerfumeSpinner';
import { BASE_URL, authFetchWithRefresh } from '../infrastructure/api/client';
import { useAuthContext } from '../application/context/useAuthContext';
import { useSeo } from '../application/hooks/useSeo';

interface Referido { nombre: string; fecha: string; compro: boolean }
interface Data { codigo: string; referidos: Referido[] }

const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** Portal "Invita y gana": link de referido + amigos invitados y su estado. */
export default function InvitaPage() {
  useSeo('Invita y gana');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [data, setData] = useState<Data | null>(null);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(() => {
    authFetchWithRefresh(`${BASE_URL}/api/portal/referidos`)
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((j) => setData(j.data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    cargar();
  }, [user, navigate, cargar]);

  const link = data ? `${window.location.origin}/register?ref=${data.codigo}` : '';
  const copiar = () => {
    navigator.clipboard?.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-20 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Portal del cliente</p>
        <h1 className="mt-2 flex items-center gap-2.5 font-display text-4xl font-light tracking-tight text-ink">
          <Gift className="size-7 text-primary" /> Invita y gana
        </h1>

        {cargando || !data ? (
          <PerfumeSpinner />
        ) : (
          <>
            <div className="mt-8 rounded-2xl border border-border bg-card p-5">
              <p className="text-[13.5px] text-muted-foreground">Comparte tu enlace. Cuando tu amigo se registre y haga su <strong className="text-foreground">primera compra</strong>, ¡ganas! (nos escribes y lo coordinamos).</p>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2">
                <span className="min-w-0 flex-1 truncate px-2 text-[13px] text-foreground">{link}</span>
                <Button size="sm" className="shrink-0 rounded-full" onClick={copiar}>
                  {copiado ? <><Check className="size-4" /> Copiado</> : <><Copy className="size-4" /> Copiar</>}
                </Button>
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground/80">Tu código: <span className="font-mono font-medium text-foreground">{data.codigo}</span></p>
            </div>

            <h2 className="mt-8 flex items-center gap-2 font-display text-xl font-light text-ink">
              <Users className="size-5 text-primary" /> Tus invitados ({data.referidos.length})
            </h2>
            {data.referidos.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted-foreground">Aún no has invitado a nadie. ¡Comparte tu enlace!</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {data.referidos.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div>
                      <p className="text-[14px] font-medium text-foreground">{r.nombre}</p>
                      <p className="text-[12px] text-muted-foreground">Se unió el {fmt(r.fecha)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11.5px] font-medium ${r.compro ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.compro ? 'Ya compró 🎉' : 'Sin comprar aún'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
