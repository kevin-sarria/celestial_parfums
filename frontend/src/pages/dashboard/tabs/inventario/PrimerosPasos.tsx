import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BASE_URL } from '../../../../infrastructure/api/client';
import type { GuardedFetch } from '../../types';

/** Los cuatro contadores con los que se deduce el progreso. */
interface Progreso {
  materiales: number;
  conteos: number;
  compras: number;
  faltan_esencia: number;
  fabricados: number;
}

interface PrimerosPasosProps {
  guardedFetch: GuardedFetch;
  /** Abre el modal de Ajustar del primer insumo sin existencias. */
  onContar: () => void;
  /** Abre la asignación de esencias en bloque. */
  onAsignarEsencias: () => void;
  /** Abre el formulario para dar de alta un material. */
  onAgregarMaterial: () => void;
  /** Sube al padre cuántos fabricados siguen sin esencia (para el modal). */
  recargar?: number;
}

interface Paso {
  n: number;
  titulo: string;
  hecho: boolean;
  detalle: ReactNode;
  /** Nota ámbar: la consecuencia de saltarse el orden, en plata. */
  aviso?: string;
  accion: ReactNode;
}

/**
 * Lista de arranque del inventario.
 *
 * El progreso se deduce SIEMPRE de los datos, nunca de una bandera de "ya lo
 * hizo": una bandera mentiría el día que se cargue algo por Excel, y quien ya
 * tiene su inventario andando no debe ver esta caja nunca.
 *
 * Solo hay UN orden obligatorio (contar antes de comprar) y aun así se avisa,
 * no se bloquea: imponer orden donde no hace falta es la rigidez que el dueño
 * rechazó. Ver docs/superpowers/specs/2026-08-04-primeros-pasos-inventario-design.md
 */
export function PrimerosPasos({ guardedFetch, onContar, onAsignarEsencias, onAgregarMaterial, recargar = 0 }: PrimerosPasosProps) {
  const [p, setP] = useState<Progreso | null>(null);
  const [abierto, setAbierto] = useState(true);

  useEffect(() => {
    let vivo = true;
    guardedFetch(`${BASE_URL}/api/inventario/primeros-pasos`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (vivo && j?.data) setP(j.data); })
      // Silencioso a propósito: es una ayuda, no la pantalla. Si falla, la
      // pestaña sigue sirviendo igual y no tiene sentido alarmar.
      .catch(() => {});
    return () => { vivo = false; };
  }, [guardedFetch, recargar]);

  if (!p) return null;

  const pasos: Paso[] = [
    {
      n: 1,
      titulo: 'Dinos qué materiales usas',
      hecho: p.materiales > 0,
      detalle: p.materiales > 0
        ? `${p.materiales} registrados`
        : 'Las esencias, los envases y los accesorios con los que armas.',
      // Antes llevaba a la pestaña "Insumos y precios"; ahora los materiales se
      // dan de alta aquí mismo, en Inventario.
      accion: <Button size="sm" variant="outline" onClick={onAgregarMaterial}>Empezar</Button>,
    },
    {
      n: 2,
      titulo: 'Cuenta lo que tienes hoy',
      hecho: p.conteos > 0,
      detalle: p.conteos > 0
        ? 'Ya sembraste tus existencias'
        : 'Cuánto hay en tu bodega y cuánto costó. Con esto basta: no hace falta el historial.',
      accion: <Button size="sm" variant="outline" onClick={onContar}>Empezar</Button>,
    },
    {
      n: 3,
      // "primera compra" se leía como "la primera que hiciste en tu vida" y el
      // dueño entendió que tenía que ir a buscar facturas viejas. No hace falta:
      // el conteo del paso 2 ya captura cuánto hay y cuánto costó.
      titulo: 'Registra la próxima compra que te llegue',
      hecho: p.compras > 0,
      detalle: p.compras > 0
        ? 'Ya tienes compras con su detalle'
        : 'De aquí en adelante. No busques facturas viejas: el paso 2 ya dice qué tienes y cuánto costó.',
      aviso: p.conteos === 0 && p.compras === 0
        ? 'Haz antes el paso 2. Si compras primero, lo que ya tenías entra al precio de esta compra y el costo te queda mal sin que se note.'
        : undefined,
      accion: <Button size="sm" variant="outline" asChild><Link to="/dashboard/pagos?nueva=1">Empezar</Link></Button>,
    },
    {
      n: 4,
      titulo: 'Dile a cada perfume con qué esencia se hace',
      hecho: p.faltan_esencia === 0,
      detalle: p.faltan_esencia === 0
        ? 'Todos configurados'
        : `Faltan ${p.faltan_esencia} de ${p.fabricados}. Sin esto, vender no descuenta material.`,
      accion: <Button size="sm" variant="outline" onClick={onAsignarEsencias}>Asignar</Button>,
    },
  ];

  const listos = pasos.filter(s => s.hecho).length;
  // Terminado el arranque, la caja desaparece sola: ya cumplió su trabajo.
  if (listos === pasos.length) return null;

  return (
    <div className="rounded-2xl border border-primary/25 bg-brand-soft/40 px-4 py-3.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Primeros pasos
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            Haz esto una vez y el inventario empieza a trabajar solo.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-[12.5px] font-medium tabular-nums text-foreground">
            {listos} de {pasos.length}
          </span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {abierto && (
        <ol className="mt-3 flex flex-col gap-2">
          {pasos.map(s => (
            <li
              key={s.n}
              className={`flex flex-wrap items-start gap-3 rounded-xl border px-3 py-2.5 ${
                s.hecho ? 'border-border/60 bg-card/50' : 'border-border bg-card'
              }`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  s.hecho ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'
                }`}
              >
                {s.hecho ? <Check className="size-3" /> : s.n}
              </span>

              <span className="min-w-40 flex-1">
                <span className={`block text-[13.5px] font-medium ${s.hecho ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {s.titulo}
                </span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">{s.detalle}</span>
                {s.aviso && (
                  <span className="mt-1.5 flex items-start gap-1.5 text-[12px] font-medium text-amber-700">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    {s.aviso}
                  </span>
                )}
              </span>

              {!s.hecho && <span className="shrink-0">{s.accion}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
