import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { BASE_URL } from '../../infrastructure/api/client';
import { fetchJsonCached } from '../../infrastructure/api/cachedFetch';

interface Ganador {
  id: number;
  cliente: string;
  premio: string;
  imagenes: string[];
  fecha: string;
}

/**
 * Galería pública de "ganadores": fotos de premios entregados (aprobadas por el
 * admin). Publicidad social gratis. Se puede poner en el home y en el portal.
 */
export default function GaleriaGanadores({ titulo = 'Nuestros ganadores' }: { titulo?: string }) {
  const [ganadores, setGanadores] = useState<Ganador[]>([]);
  const [amplia, setAmplia] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetchJsonCached<{ data?: Ganador[] }>(`${BASE_URL}/api/recompensas/ganadores`)
      .then((j) => { if (vivo) setGanadores(j.data ?? []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Aplana a fotos individuales con su ganador
  const fotos = ganadores.flatMap((g) => g.imagenes.map((url) => ({ url, cliente: g.cliente, premio: g.premio })));
  if (fotos.length === 0) return null;

  return (
    <section className="w-full">
      <div className="mb-4 flex items-center justify-center gap-2 text-center">
        <Trophy className="size-5" style={{ color: '#d9b45a' }} />
        <h2 className="font-display text-2xl font-light text-ink">{titulo}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {fotos.slice(0, 12).map((f, i) => (
          <button key={i} type="button" onClick={() => setAmplia(f.url)}
            className="group relative overflow-hidden rounded-xl border border-border">
            <img src={f.url} alt={`Premio de ${f.cliente}`} loading="lazy"
              className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-[11px] font-medium text-white">
              {f.cliente.split(' ')[0]} 🎁
            </span>
          </button>
        ))}
      </div>

      {amplia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setAmplia(null)}>
          <img src={amplia} alt="" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
        </div>
      )}
    </section>
  );
}
