import { useEffect, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SelectSimple } from '@/components/ui/select-simple';
import SubirFotosEntrega, { type EntregaCliente } from '../../../components/recompensas/SubirFotosEntrega';
import { BASE_URL } from '../../../infrastructure/api/client';
import { fmtInstante } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import type { GuardedFetch } from '../types';

interface Props { guardedFetch: GuardedFetch }

interface EntregaAdmin extends EntregaCliente {
  cliente: string;
}

const ESTADO: Record<string, string> = {
  pendiente: 'border-amber-300 bg-amber-50 text-amber-700',
  aprobada: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  rechazada: 'border-rose-300 bg-rose-50 text-rose-700',
};

/**
 * Admin: fotos de premios entregados. El admin puede subir la prueba en nombre
 * del cliente y aprobar/rechazar antes de que salgan en la galería pública.
 */
export default function EntregasModeracion({ guardedFetch }: Props) {
  const [rows, setRows] = useState<EntregaAdmin[]>([]);
  const [estado, setEstado] = useState('');

  const load = async (est = estado) => {
    const qs = est ? `?estado=${est}` : '';
    const res = await guardedFetch(`${BASE_URL}/api/recompensas/admin/entregas${qs}`);
    const json = await res.json();
    setRows(json.data ?? []);
  };

  useEffect(() => { load(estado); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const moderar = async (id: number, nuevo: 'aprobada' | 'rechazada') => {
    await guardedFetch(`${BASE_URL}/api/recompensas/admin/entregas/${id}`, { method: 'PATCH', body: JSON.stringify({ estado: nuevo }) });
    load();
  };
  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar esta entrega y sus fotos?')) return;
    await guardedFetch(`${BASE_URL}/api/recompensas/admin/entregas/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={rows.length}>Fotos de ganadores</SectionTitle>
        <ToolbarActions>
          <SelectSimple value={estado} onChange={(e) => setEstado(e.target.value)} className="w-44">
            <option value="">Todas</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Publicadas</option>
            <option value="rechazada">Rechazadas</option>
          </SelectSimple>
        </ToolbarActions>
      </Toolbar>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Aún no hay premios entregados.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((e) => (
            <li key={e.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[14px] font-medium text-foreground">{e.cliente}</p>
                  <p className="text-[12px] text-muted-foreground">🎁 {e.premio} · {fmtInstante(e.fecha)}</p>
                </div>
                <Badge variant="outline" className={`rounded-full text-[10.5px] ${ESTADO[e.estado]}`}>{e.estado}</Badge>
              </div>

              <div className="mt-3">
                <SubirFotosEntrega
                  entrega={e}
                  nota={false}
                  url={`${BASE_URL}/api/recompensas/admin/entregas/${e.id}/fotos`}
                  onSubido={load}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {e.estado !== 'aprobada' && e.imagenes.length > 0 && (
                  <Button size="sm" className="h-8" onClick={() => moderar(e.id, 'aprobada')}>
                    <Check className="size-4" /> Publicar en galería
                  </Button>
                )}
                {e.estado !== 'rechazada' && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => moderar(e.id, 'rechazada')}>
                    <X className="size-4" /> Ocultar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => eliminar(e.id)}>
                  <Trash2 className="size-4" /> Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
