import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Estrellas from '../Estrellas';
import DistribucionEstrellas from './DistribucionEstrellas';
import ResenaItem from './ResenaItem';
import ResenasModal from './ResenasModal';
import VisorImagenes from './VisorImagenes';
import { contarPorEstrella, type Resena } from './tipos';
import { BASE_URL } from '../../infrastructure/api/client';
import { fetchJsonCached } from '../../infrastructure/api/cachedFetch';

interface Props {
  perfumeId: number;
  nombre: string;
  promedio: number;
  total: number;
  /** Modal controlado desde la página (para abrirlo también desde el rating de arriba). */
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PREVIEW = 3;

/** Sección pública de reseñas: resumen con distribución + preview + modal con filtro y carrusel. */
export default function ResenasProducto({ perfumeId, nombre, promedio, total, open, onOpenChange }: Props) {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [visor, setVisor] = useState<{ imgs: string[]; i: number } | null>(null);
  const conteo = useMemo(() => contarPorEstrella(resenas), [resenas]);

  useEffect(() => {
    let vivo = true;
    fetchJsonCached<{ data?: Resena[] }>(`${BASE_URL}/api/resenas/producto/${perfumeId}`)
      .then((j) => { if (vivo) setResenas(j.data ?? []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [perfumeId]);

  if (total === 0 && resenas.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-8">
      <h2 className="mb-5 font-display text-2xl font-light text-ink">Opiniones del producto</h2>

      {resenas.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">Aún no hay reseñas publicadas de este perfume.</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr]">
          {/* Resumen con distribución (clic filtra y abre el modal) */}
          <div className="rounded-2xl border border-border bg-secondary/40 p-5">
            <div className="flex items-center gap-4">
              <span className="font-display text-5xl font-light leading-none text-ink">{promedio.toFixed(1)}</span>
              <div className="flex flex-col gap-1">
                <Estrellas valor={promedio} size={16} />
                <span className="text-[12px] text-muted-foreground">{total} {total === 1 ? 'opinión' : 'opiniones'}</span>
              </div>
            </div>
            <div className="mt-4">
              <DistribucionEstrellas conteo={conteo} total={total} onFiltro={() => onOpenChange(true)} />
            </div>
            <button type="button" onClick={() => onOpenChange(true)}
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80">
              Ver todas las opiniones <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Preview de las primeras reseñas */}
          <div>
            {resenas.slice(0, PREVIEW).map((r) => (
              <ResenaItem key={r.id} resena={r} onImagen={(imgs, i) => setVisor({ imgs, i })} />
            ))}
            {resenas.length > PREVIEW && (
              <button type="button" onClick={() => onOpenChange(true)}
                className="mt-4 inline-flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary">
                Ver las {total} opiniones <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <ResenasModal open={open} onClose={() => onOpenChange(false)} nombre={nombre}
        resenas={resenas} promedio={promedio} total={total} />

      {visor && <VisorImagenes imagenes={visor.imgs} inicio={visor.i} onClose={() => setVisor(null)} />}
    </section>
  );
}
