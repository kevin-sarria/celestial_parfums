import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Modal from '../../../../components/Modal';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { hoy } from '../../../../utils/fechas';
import { ETIQUETA_AMBITO, type AlertaDisparada } from './ambitos';

/**
 * EL AVISO DE INVENTARIO EN EL DASHBOARD.
 *
 * Lo pidió así el dueño (2026-08-29): *"una súper alerta que salga en medio de
 * todo, solo visible para el dashboard, así como la parte que tengo de anuncios
 * para los clientes"*. Él decide en *Alertas de inventario* si cada familia
 * avisa con una franja discreta o con una ventana en medio.
 *
 * **Cuándo vuelve a salir después de cerrarla**: al día siguiente, o antes si
 * aparece un material nuevo en la lista. Esa segunda parte no es un adorno — una
 * alerta que se cierra "hasta mañana" y se calla mientras se acaban tres cosas
 * más es exactamente igual a no tener alerta. La firma que se guarda son los ids
 * que la dispararon: si cambian, es otra alerta.
 */

const CLAVE = 'celestial:alertas-cerradas';

const firmaDe = (a: AlertaDisparada) =>
  `${a.ambito}:${a.materiales.map((m) => m.id).sort((x, y) => x - y).join(',')}`;

const leerCerradas = (): Record<string, string> => {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const dato = crudo ? JSON.parse(crudo) : null;
    // Solo valen las de HOY: mañana la alerta vuelve a salir.
    return dato?.dia === hoy() ? (dato.firmas ?? {}) : {};
  } catch {
    // Un JSON corrupto no puede dejar al dueño sin avisos.
    return {};
  }
};

const guardarCerrada = (firma: string) => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({
      dia: hoy(), firmas: { ...leerCerradas(), [firma]: '1' },
    }));
  } catch { /* sin localStorage el aviso sale siempre: es el lado seguro */ }
};

const Lista = ({ alerta }: { alerta: AlertaDisparada }) => (
  <ul className="mt-1.5 flex flex-wrap gap-1.5">
    {alerta.materiales.map((m) => (
      <li key={m.id} className="rounded-full border border-amber-500/40 bg-card px-2.5 py-0.5 text-[12px]">
        {m.nombre} · <strong>{m.stock.toLocaleString('es-CO')} {m.unidad === 'ml' ? 'ml' : 'u'}</strong>
      </li>
    ))}
  </ul>
);

export function AvisoAlertas({ onVerPedido, recargarCon }: {
  onVerPedido: () => void;
  /**
   * Cambia este valor para que el aviso se vuelva a preguntar. El dashboard le
   * pasa la pestaña actual: sin esto, el aviso seguía nombrando un material que
   * el dueño acababa de marcar en prueba, porque solo se consultaba al montar.
   */
  recargarCon?: string;
}) {
  const [alertas, setAlertas] = useState<AlertaDisparada[]>([]);
  const [cerradas, setCerradas] = useState<Record<string, string>>(leerCerradas);

  useEffect(() => {
    // Silencioso a propósito: si falla, el dashboard entra igual. Un aviso que
    // no se pudo cargar no puede bloquear la pantalla de trabajo.
    http.get<{ data: AlertaDisparada[] }>(urls.inventario.alertasActivas)
      .then((r) => { if (r.ok && r.cuerpo?.data) setAlertas(r.cuerpo.data); });
  }, [recargarCon]);

  const cerrar = (a: AlertaDisparada) => {
    const firma = firmaDe(a);
    guardarCerrada(firma);
    setCerradas((prev) => ({ ...prev, [firma]: '1' }));
  };

  const visibles = alertas.filter((a) => !cerradas[firmaDe(a)]);
  if (!visibles.length) return null;

  const ventana = visibles.find((a) => a.forma === 'ventana');
  const franjas = visibles.filter((a) => a.forma === 'franja');

  return (
    <>
      {franjas.map((a) => (
        <div key={a.ambito}
          className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3.5 py-3 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{a.titulo}</p>
            {a.mensaje && <p className="mt-0.5 text-[12.5px]">{a.mensaje}</p>}
            <Lista alerta={a} />
          </div>
          <Button size="sm" variant="outline" className="h-7" onClick={onVerPedido}>
            Ver qué pedir
          </Button>
          <Button size="icon" variant="ghost" className="size-7" title="Cerrar por hoy"
            onClick={() => cerrar(a)}>
            <X className="size-4" />
          </Button>
        </div>
      ))}

      {/* Solo UNA ventana a la vez: dos modales encadenados al entrar es lo que
          convierte un aviso en un trámite que se cierra sin leer. */}
      {ventana && (
        <Modal open onClose={() => cerrar(ventana)} title={ventana.titulo}
          onSubmit={(e) => { e.preventDefault(); cerrar(ventana); onVerPedido(); }}
          submitLabel="Ver qué pedir" cancelLabel="Cerrar por hoy">
          {ventana.mensaje && <p className="text-[13px] text-muted-foreground">{ventana.mensaje}</p>}
          <p className="text-[13px]">
            Tienes <strong>{ventana.materiales.length}</strong>{' '}
            {ETIQUETA_AMBITO[ventana.ambito].toLowerCase()} por debajo de{' '}
            <strong>{ventana.minimo.toLocaleString('es-CO')}</strong>:
          </p>
          <Lista alerta={ventana} />
        </Modal>
      )}
    </>
  );
}
