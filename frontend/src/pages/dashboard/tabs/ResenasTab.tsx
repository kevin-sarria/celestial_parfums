import { useEffect, useState } from 'react';
import { Check, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { BASE_URL } from '../../../infrastructure/api/client';
import { DEFAULT_PAGE_SIZE, fmtInstante } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import type { GuardedFetch } from '../types';

interface Props { guardedFetch: GuardedFetch }

interface ResenaAdmin {
  id: number;
  perfume?: { id: number; nombre: string; imagen_url: string | null };
  autor: string;
  rating: number;
  comentario: string;
  imagenes: string[];
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fecha: string;
}

const ESTADO: Record<string, string> = {
  pendiente: 'border-amber-300 bg-amber-50 text-amber-700',
  aprobada: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  rechazada: 'border-rose-300 bg-rose-50 text-rose-700',
};

/** Moderación de reseñas: aprobar (se publican), rechazar (se ocultan) o eliminar. */
export function ResenasTab({ guardedFetch }: Props) {
  const [rows, setRows] = useState<ResenaAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('pendiente');
  const [loading, setLoading] = useState(true);

  const load = async (p = page, est = estado) => {
    setLoading(true);
    const qs = est ? `&estado=${est}` : '';
    const res = await guardedFetch(`${BASE_URL}/api/resenas/admin?page=${p}&limit=${DEFAULT_PAGE_SIZE}${qs}`);
    const json = await res.json();
    setRows(json.data ?? []); setTotal(json.total ?? 0); setPage(p); setLoading(false);
  };

  useEffect(() => { load(1, estado); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const moderar = async (id: number, nuevo: 'aprobada' | 'rechazada') => {
    await guardedFetch(`${BASE_URL}/api/resenas/admin/${id}`, { method: 'PATCH', body: JSON.stringify({ estado: nuevo }) });
    load();
  };
  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar esta reseña? No se puede deshacer.')) return;
    await guardedFetch(`${BASE_URL}/api/resenas/admin/${id}`, { method: 'DELETE' });
    load();
  };

  const totalPaginas = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={total}>Reseñas</SectionTitle>
        <ToolbarActions>
          <NativeSelect value={estado} onChange={(e) => setEstado(e.target.value)} className="w-44">
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Publicadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="">Todas</option>
          </NativeSelect>
        </ToolbarActions>
      </Toolbar>

      {loading ? <PerfumeSpinner /> : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">No hay reseñas en este estado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                {r.perfume?.imagen_url && (
                  <img src={r.perfume.imagen_url} alt="" className="size-12 rounded-lg border border-border bg-white object-contain p-0.5" />
                )}
                <div className="min-w-40 flex-1">
                  <p className="text-[14px] font-medium text-foreground">{r.perfume?.nombre ?? 'Producto'}</p>
                  <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className="size-3" style={{ color: '#d9b45a', fill: r.rating >= n ? '#d9b45a' : 'transparent' }} strokeWidth={1.5} />
                      ))}
                    </span>
                    · {r.autor} · {fmtInstante(r.fecha)}
                  </p>
                </div>
                <Badge variant="outline" className={`rounded-full text-[10.5px] ${ESTADO[r.estado]}`}>{r.estado}</Badge>
              </div>

              {r.comentario && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{r.comentario}</p>}
              {r.imagenes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.imagenes.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      <img src={u} alt="" className="size-16 rounded-lg border border-border object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {r.estado !== 'aprobada' && (
                  <Button size="sm" className="h-8" onClick={() => moderar(r.id, 'aprobada')}>
                    <Check className="size-4" /> Aprobar y publicar
                  </Button>
                )}
                {r.estado !== 'rechazada' && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => moderar(r.id, 'rechazada')}>
                    <X className="size-4" /> Rechazar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => eliminar(r.id)}>
                  <Trash2 className="size-4" /> Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-[13px]">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Anterior</Button>
          <span className="text-muted-foreground">Página {page} de {totalPaginas}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPaginas} onClick={() => load(page + 1)}>Siguiente</Button>
        </div>
      )}
    </Section>
  );
}
