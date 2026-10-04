import { useEffect, useState } from 'react';
import { Check, Inbox, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import { NoSePudoCargar } from '../../../components/NoSePudoCargar';
import { useAuthContext } from '../../../application/context/useAuthContext';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Field, Section, SectionTitle, Toolbar } from '../ui';

interface Solicitud {
  id: number;
  tipo: 'borrar_venta' | 'borrar_credito' | 'descuento_venta' | 'descuento_credito';
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  resumen: string;
  motivo: string;
  solicitante: string;
  respuesta: string | null;
  created_at: string;
}

const QUE: Record<Solicitud['tipo'], string> = {
  borrar_venta: 'Borrar una venta', borrar_credito: 'Borrar un crédito',
  descuento_venta: 'Descuento en una venta', descuento_credito: 'Descuento en un crédito',
};

/** Qué pasa si se aprueba o se rechaza, dicho antes de decidir. */
const CONSECUENCIA: Record<Solicitud['tipo'], { si: string; no: string }> = {
  borrar_venta: { si: 'Se borra y la mercancía vuelve al inventario.', no: 'La venta se queda como está.' },
  borrar_credito: { si: 'Se borra y la mercancía vuelve al inventario.', no: 'El crédito se queda como está.' },
  descuento_venta: { si: 'Se registra la venta con el descuento.', no: 'Se registra a precio normal, sin regalos ni cupón.' },
  descuento_credito: { si: 'Se registra el crédito con el descuento.', no: 'Se registra a precio normal, sin regalos ni cupón.' },
};

const ESTADO = {
  pendiente: { texto: 'Esperando', clase: 'bg-amber-100 text-amber-800' },
  aprobada: { texto: 'Aprobada', clase: 'bg-emerald-100 text-emerald-800' },
  rechazada: { texto: 'Rechazada', clase: 'bg-secondary text-muted-foreground' },
};

const cuando = (iso: string) => new Date(iso).toLocaleString('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit',
});

/**
 * SOLICITUDES (2026-10-04): lo que el personal pide y solo el dueño decide —
 * borrar una venta o un crédito, o un descuento. El dueño las ve todas con
 * Aprobar / Rechazar (y la campana le avisa); el personal ve las suyas.
 */
export function SolicitudesTab() {
  const { isAdmin } = useAuthContext();
  const [filas, setFilas] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState('');
  const [decidiendo, setDecidiendo] = useState<number | null>(null);
  const [rechazando, setRechazando] = useState<Solicitud | null>(null);
  const [respuesta, setRespuesta] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: Solicitud[] }>(urls.solicitudes.lista);
      if (!res.ok) { setFallo(res.error); return; }
      setFilas(res.cuerpo?.data ?? []);
      setFallo('');
    } catch { setFallo('No se pudo conectar con el servidor'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const decidir = async (s: Solicitud, decision: 'aprobar' | 'rechazar', texto?: string) => {
    setDecidiendo(s.id);
    try {
      const res = await http.post(urls.solicitudes.decidir(s.id, decision), texto ? { respuesta: texto } : {});
      if (!res.ok) { toast.error(res.error, { id: 'solicitudes' }); return; }
      const estado = decision === 'aprobar' ? 'aprobada' : 'rechazada';
      setFilas(prev => prev.map(f => (f.id === s.id ? { ...f, estado, respuesta: texto || null } : f)));
      toast.success(decision === 'aprobar' ? `Aprobada. ${CONSECUENCIA[s.tipo].si}` : `Rechazada. ${CONSECUENCIA[s.tipo].no}`, { id: 'solicitudes' });
      setRechazando(null);
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'solicitudes' }); }
    finally { setDecidiendo(null); }
  };

  const pendientes = filas.filter(f => f.estado === 'pendiente').length;

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={pendientes}>{isAdmin ? 'Solicitudes de tu equipo' : 'Mis solicitudes'}</SectionTitle>
      </Toolbar>
      <p className="-mt-1 mb-4 text-[12.5px] text-muted-foreground">
        {isAdmin
          ? 'Lo que tu equipo te pide aprobar: borrar una venta o un crédito, o un descuento. Una venta con descuento no cuenta en tus números hasta que decides.'
          : 'Lo que le has pedido al dueño. Una venta con descuento se registra cuando él la aprueba o la rechaza.'}
      </p>

      {fallo && <NoSePudoCargar que="las solicitudes" onReintentar={cargar} />}
      {!fallo && !cargando && filas.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          <Inbox className="mx-auto mb-2 size-6 text-primary" />
          No hay solicitudes.
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {filas.map(s => (
          <li key={s.id} className={cn('rounded-xl border bg-card p-4', s.estado === 'pendiente' ? 'border-primary/40' : 'border-border')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {QUE[s.tipo]} · {s.solicitante} · {cuando(s.created_at)}
                </p>
                <p className="mt-1 text-[14px] font-medium text-foreground">{s.resumen}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Motivo: {s.motivo}</p>
                {s.respuesta && <p className="mt-0.5 text-[13px] text-muted-foreground">Respuesta: {s.respuesta}</p>}
                {isAdmin && s.estado === 'pendiente' && (
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    Si apruebas: {CONSECUENCIA[s.tipo].si} Si rechazas: {CONSECUENCIA[s.tipo].no}
                  </p>
                )}
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium', ESTADO[s.estado].clase)}>
                {ESTADO[s.estado].texto}
              </span>
            </div>
            {isAdmin && s.estado === 'pendiente' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={decidiendo === s.id} onClick={() => decidir(s, 'aprobar')}>
                  <Check className="size-4" /> Aprobar
                </Button>
                <Button size="sm" variant="outline" disabled={decidiendo === s.id} onClick={() => { setRespuesta(''); setRechazando(s); }}>
                  <X className="size-4" /> Rechazar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal
        open={rechazando != null}
        onClose={() => setRechazando(null)}
        title="Rechazar la solicitud"
        onSubmit={e => { e.preventDefault(); if (rechazando) decidir(rechazando, 'rechazar', respuesta.trim()); }}
        submitLabel={decidiendo ? 'Rechazando…' : 'Rechazar'}
        loading={decidiendo != null}
        maxWidth={460}
      >
        {rechazando && <p className="text-[13px] text-muted-foreground">{CONSECUENCIA[rechazando.tipo].no}</p>}
        <Field label="¿Por qué? (opcional, lo verá quien la pidió)">
          <Textarea rows={2} maxLength={300} value={respuesta} onChange={e => setRespuesta(e.target.value)} />
        </Field>
      </Modal>
    </Section>
  );
}
