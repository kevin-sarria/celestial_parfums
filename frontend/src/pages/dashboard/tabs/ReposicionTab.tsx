import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { EncabezadoPagina, FranjaMetricas, StatCard } from '../ui';
import { formatPrice } from '../helpers';
import { useAjustesPedido } from './reposicion/useAjustesPedido';
import { TablaPedido, cantidad, type Fila } from './reposicion/TablaPedido';
import { MinimosModal, type Gama } from './reposicion/MinimosModal';

interface Datos {
  esencias: Fila[]; implementos: Fila[];
  sin_historial: boolean; dias_historial: number; dias_cobertura: number;
  costo_total: number;
}


/**
 * Pedido sugerido: qué material hay que reponer y cuánto pedir.
 *
 * Es **solo informativa**: no mueve stock ni registra nada. Vive en su propia
 * pantalla porque responde una pregunta distinta a las demás — Inventario dice
 * *qué tengo*, Producciones *qué armé*, y esta *qué me falta*.
 *
 * El punto de pedido se configura **por gama** (una vez para las 151 árabes) y
 * cada material puede llevar su excepción. Sin eso la alerta no se usaba: se
 * midió y solo 1 de 226 materiales tenía mínimo puesto, porque ponerlo a mano
 * en 219 esencias no lo hace nadie.
 */
export function ReposicionTab() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [gamas, setGamas] = useState<Gama[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [minimosAbierto, setMinimosAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [rRepo, rGamas] = await Promise.all([
        http.get<{ data: Datos }>(urls.inventario.reposicion),
        http.get<{ data: Gama[] }>(urls.costeo.gamas),
      ]);
      if (!rRepo.ok) { setError(rRepo.error); return; }
      setDatos(rRepo.cuerpo?.data ?? null);
      // Las gamas solo hacen falta para el modal de configuración; si fallan,
      // la lista de pedido se sigue viendo
      if (rGamas.ok) setGamas(rGamas.cuerpo?.data ?? []);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * Los retoques del dueño sobre lo que el sistema propone. Viven en el
   * navegador: esta pantalla se recalcula del inventario en cada visita, así
   * que guardarlos en el servidor la convertiría en un documento de orden de
   * compra, que es otra cosa.
   */
  const idsEnLista = useMemo(
    () => (datos ? [...datos.esencias, ...datos.implementos].map((f) => f.id) : []),
    [datos],
  );
  const ajustes = useAjustesPedido(idsEnLista);

  /**
   * Guardar NO vuelve a pedir la lista.
   *
   * El endpoint devuelve la reposición ya recalculada, así que la pantalla se
   * refresca con esa respuesta. Antes se llamaba a `cargar()` después de cada
   * guardado: una petición más, y un parpadeo de "Calculando…" cada vez.
   *
   * Los mínimos de las gamas se actualizan en el estado local con lo que se
   * acaba de mandar, que es lo que el servidor guardó.
   */
  const aplicarGuardado = (reposicion: unknown, nuevos: Record<number, number>) => {
    setDatos(reposicion as Datos);
    setGamas((lista) => lista.map((g) => (
      nuevos[g.id] != null ? { ...g, stock_minimo: nuevos[g.id] } : g
    )));
  };

  /**
   * La lista tal como se pega en WhatsApp: un renglón por material.
   *
   * Se le quita el sufijo "– Esencia" del nombre interno: al proveedor se le
   * pide "Eternity - 100 ml", no "Eternity – Esencia - 100 ml". Ese sufijo
   * existe para no confundir el material con el perfume dentro del sistema, y
   * fuera de él solo estorba.
   *
   * Se copia **lo ajustado**, no lo sugerido: si el dueño subió una cantidad o
   * sacó un material, el mensaje tiene que decir lo que de verdad va a pedir.
   */
  const textoParaPedir = (filas: Fila[]) =>
    filas
      .filter((f) => !ajustes.estaQuitado(f.id) && ajustes.cantidadDe(f.id, f.sugerido) > 0)
      .map((f) => `${f.nombre.replace(/\s*[–—-]\s*esencias?\s*$/i, '').trim()} - ${cantidad(ajustes.cantidadDe(f.id, f.sugerido), f.unidad)}`)
      .join('\n');

  const copiar = async (filas: Fila[]) => {
    const texto = textoParaPedir(filas);
    if (!texto) {
      toast.error('No queda nada por copiar: sacaste todos los materiales de la lista',
        { id: 'copiar' });
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success(`${texto.split('\n').length} materiales copiados. Pégalos en WhatsApp.`);
    } catch {
      // Sin permiso de portapapeles el navegador no deja copiar en silencio
      toast.error('Tu navegador no dejó copiar. Selecciona el texto a mano.', { id: 'copiar' });
    }
  };

  if (cargando) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">Calculando…</p>;
  }
  if (error || !datos) {
    return (
      <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
        {error || 'No hay datos'}
        <Button size="sm" variant="outline" className="h-7" onClick={cargar}>Reintentar</Button>
      </p>
    );
  }

  const total = datos.esencias.length + datos.implementos.length;

  /**
   * Las cajas de arriba cuentan **el pedido que se va a mandar**, no la lista
   * cruda: si el dueño sacó cinco materiales y subió dos cantidades, el total
   * de plata tiene que reflejarlo o estaría mirando un número que ya no existe.
   */
  const enPedido = [...datos.esencias, ...datos.implementos]
    .filter((f) => !ajustes.estaQuitado(f.id));
  const costoAjustado = enPedido.reduce(
    (s, f) => s + Math.round(ajustes.cantidadDe(f.id, f.sugerido) * f.costo_promedio), 0);
  const esenciasEnPedido = datos.esencias.filter((f) => !ajustes.estaQuitado(f.id)).length;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Pedido sugerido" count={enPedido.length}>
        {/* Configurar cuándo avisar es de toda la pantalla, no de una tabla:
            por eso va aquí y no en la barra de una de las dos listas. */}
        <Button size="sm" variant="outline" onClick={() => setMinimosAbierto(true)}>
          <BellRing className="size-4" /> ¿Cuándo te aviso?
        </Button>
      </EncabezadoPagina>

      <FranjaMetricas>
        <StatCard label="Materiales por pedir" value={String(enPedido.length)}
          nota={total === 0 ? 'No te falta nada'
            : enPedido.length < total ? `De ${total} que tocaron su mínimo`
            : 'Ya tocaron su punto de pedido'} />
        <StatCard label="Esencias" value={String(esenciasEnPedido)}
          nota="Se piden aparte del resto" />
        <StatCard label="Costará aproximadamente" value={formatPrice(costoAjustado)}
          nota={ajustes.hayAjustes ? 'Con tus ajustes' : 'Al costo promedio que llevan hoy'} />
      </FranjaMetricas>

      {/* Sin esto, un ajuste de hace tres semanas seguiría mandando en silencio */}
      {ajustes.hayAjustes && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3.5 py-2 text-[12px] text-muted-foreground">
          <span>
            Estás viendo <strong className="text-foreground">tu versión</strong> de la lista:
            las cantidades que cambiaste se guardan en este navegador.
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={ajustes.empezarDeCero}>
            <RotateCcw className="size-3.5" /> Volver a lo sugerido
          </Button>
        </p>
      )}

      {/**
        * La configuración de los mínimos vive en un MODAL, no desplegada aquí.
        *
        * Ocupaba una franja entera con cuatro casillas y cuatro botones "ok",
        * y el dueño pidió esconderla. Tiene razón por dónde se mire: es algo
        * que se toca una vez y luego se consulta la lista cien veces — el
        * mismo criterio con el que las descargas de Excel salieron de la barra
        * de Inventario. Lo que hace usable la alerta es poder configurar "las
        * árabes" de una vez; no que el formulario esté siempre a la vista.
        */}
      {minimosAbierto && (
        <MinimosModal
          gamas={gamas}
          onClose={() => setMinimosAbierto(false)}
          onGuardado={aplicarGuardado}
        />
      )}

      {/* Honestidad sobre de dónde sale el número: sin salidas registradas no
          hay consumo que proyectar, y prometer precisión sería mentir. */}
      {datos.sin_historial && (
        <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-snug text-amber-900">
          Todavía no hay salidas registradas, así que la cantidad sugerida sale del mínimo
          que configures (te propone volver al doble). Cuando lleves unas semanas
          produciendo y vendiendo, el sistema empezará a calcularla con lo que de verdad
          gastas en {datos.dias_historial} días y a pedir para cubrir {datos.dias_cobertura}.
        </p>
      )}

      <TablaPedido titulo="Esencias" filas={datos.esencias}
        nota="Lo que hay que pedirle al laboratorio"
        ajustes={ajustes} copiado={copiado} onCopiar={copiar} />
      <TablaPedido titulo="Envases, accesorios y demás" filas={datos.implementos}
        nota="Frascos, perfumeros, diluyente, sellador…"
        ajustes={ajustes} copiado={copiado} onCopiar={copiar} />
    </div>
  );
}
