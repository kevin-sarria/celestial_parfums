import { useState } from 'react';
import { Pencil, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import type { MetaMes } from './tipos';
import { CampoPesos } from '@/components/ui/campo-pesos';

/**
 * LA META DEL MES en Inicio (2026-10-02, segunda tanda de la revisión).
 *
 * Responde la pregunta de cada día: "¿voy bien?". Con la meta puesta dice
 * cuánto lleva, cuánto le falta, cuánto tiene que vender por día para llegar y
 * en cuánto cerraría si sigue al ritmo de hoy. Sin meta, la pide ahí mismo,
 * proponiendo la del mes anterior.
 *
 * Cuenta lo VENDIDO Y PAGADO, igual que la tarjeta de al lado: si contara lo
 * fiado, un crédito grande daría la meta por cumplida sin haber entrado la plata.
 */
export function MetaDelMes({ meta, vendido, mes }: { meta: MetaMes; vendido: number; mes: string }) {
  const [monto, setMonto] = useState(meta.monto);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);

  const abrir = () => { setValor(String(monto ?? meta.sugerida ?? '')); setEditando(true); };

  const guardar = async () => {
    const n = Number(valor);
    if (!(n > 0)) { toast.error('Escribe la meta en pesos', { id: 'meta' }); return; }
    setGuardando(true);
    try {
      const res = await http.patch<{ data: { monto: number } | null }>(urls.reportes('meta'), { mes: meta.mes, monto: n });
      if (!res.ok) { toast.error(res.error, { id: 'meta' }); return; }
      setMonto(res.cuerpo?.data?.monto ?? null);
      setEditando(false);
      toast.success(`Meta de ${mes.toLowerCase()}: ${formatPrice(n)}`, { id: 'meta' });
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'meta' }); }
    finally { setGuardando(false); }
  };

  const formulario = (
    <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); guardar(); }}>
      <CampoPesos autoFocus value={valor} onChange={e => setValor(e.target.value)}
        aria-label={`Meta de ventas de ${mes}`} placeholder="Ej: 3000000" className="h-9 w-40"
      />
      <Button type="submit" size="sm" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      {monto != null && <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>}
    </form>
  );

  if (monto == null || editando) {
    return (
      <div className="rounded-xl border border-dashed border-primary/40 bg-brand-soft/30 px-4 py-3.5">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
          <Target className="size-4 text-primary" />
          {monto == null ? `¿Cuánto quieres vender en ${mes.toLowerCase()}?` : `Cambiar la meta de ${mes.toLowerCase()}`}
        </p>
        {monto == null && !editando && (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Ponte una meta y aquí verás cada día si vas bien.
            {meta.sugerida != null && ` La última fue de ${formatPrice(meta.sugerida)}.`}
          </p>
        )}
        <div className="mt-2.5">{editando ? formulario : <Button size="sm" onClick={abrir}>Poner meta</Button>}</div>
      </div>
    );
  }

  const pct = Math.round((vendido / monto) * 100);
  const falta = monto - vendido;
  const diasQuedan = meta.dias_del_mes - meta.dia + 1; // hoy todavía cuenta
  const ritmo = Math.round((vendido / meta.dia) * meta.dias_del_mes);
  const vaBien = ritmo >= monto;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Target className="size-3.5 text-primary" /> Meta de {mes.toLowerCase()}
          <button type="button" onClick={abrir} aria-label="Cambiar la meta" className="rounded p-0.5 hover:text-foreground">
            <Pencil className="size-3" />
          </button>
        </p>
        <p className="text-[13px] text-muted-foreground">
          <span className="font-display text-lg font-medium tabular-nums text-foreground">{formatPrice(vendido)}</span>
          {' '}de {formatPrice(monto)} · <strong className="font-semibold text-foreground">{pct} %</strong>
        </p>
      </div>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
        {falta <= 0
          ? <span className="font-medium text-emerald-700">¡Meta cumplida! Vas {formatPrice(-falta)} por encima.</span>
          : <>
              Te faltan <strong className="font-semibold text-foreground">{formatPrice(falta)}</strong>
              {' '}en {diasQuedan} {diasQuedan === 1 ? 'día' : 'días'}: unos {formatPrice(Math.ceil(falta / diasQuedan))} por día.{' '}
              {/* Sin ventas todavía, "cierras en $0" no dice nada: solo desanima */}
              {vendido > 0 && (
                <span className={vaBien ? 'text-emerald-700' : 'text-amber-700'}>
                  A este ritmo cierras en {formatPrice(ritmo)}.
                </span>
              )}
            </>}
      </p>
    </div>
  );
}
