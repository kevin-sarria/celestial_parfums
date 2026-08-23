import { useEffect, useState } from 'react';
import { BellRing, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { toast } from 'sonner';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Section, SectionTitle, Toolbar } from '../ui';

interface Esperando { nombre: string; telefono: string | null; email: string; fecha: string }
interface Demanda { perfume_id: number; nombre: string; imagen_url: string | null; agotado: boolean; total: number; esperando: Esperando[] }

const waLink = (tel: string | null) => (tel ? `https://wa.me/57${tel.replace(/\D/g, '')}` : null);

/** Demanda de reposición: quién espera cada perfume agotado, para escribirle. */
export function AvisosTab() {
  const [rows, setRows] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await http.get<{ data: Demanda[] }>(urls.avisos.admin);
    setRows(r.cuerpo?.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const marcar = async (perfumeId: number) => {
    if (!window.confirm('¿Marcar a todos como avisados? Salen de la lista.')) return;
    const res = await http.post(urls.avisos.marcarNotificados(perfumeId));
    // Antes se ignoraba la respuesta: si fallaba, la lista se recargaba igual y
    // los clientes seguían ahí sin que nadie supiera por qué.
    if (!res.ok) { toast.error(res.error, { id: 'avisos' }); return; }
    load();
  };

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={rows.length}>Avísame cuando vuelva</SectionTitle>
      </Toolbar>

      {loading ? <PerfumeSpinner /> : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Nadie está esperando reposición por ahora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((d) => (
            <li key={d.perfume_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                {d.imagen_url && <img src={d.imagen_url} alt="" className="size-12 rounded-lg border border-border bg-white object-contain p-0.5" />}
                <div className="min-w-40 flex-1">
                  <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                    {d.nombre}
                    {d.agotado && <Badge variant="outline" className="rounded-full border-rose-300 bg-rose-50 text-[10px] text-rose-700">Agotado</Badge>}
                  </p>
                  <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><BellRing className="size-3.5" /> {d.total} {d.total === 1 ? 'persona espera' : 'personas esperan'}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => marcar(d.perfume_id)}>
                  <Check className="size-4" /> Marcar avisados
                </Button>
              </div>

              <ul className="mt-3 flex flex-col gap-1.5 border-t border-border/70 pt-3">
                {d.esperando.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="text-foreground">{e.nombre} <span className="text-muted-foreground">· {e.telefono ?? e.email}</span></span>
                    {waLink(e.telefono) && (
                      <a href={waLink(e.telefono)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                        <MessageCircle className="size-3.5" /> Escribir
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
