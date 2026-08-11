import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, ClipboardCopy, Check, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BASE_URL } from '../../../infrastructure/api/client';
import { EncabezadoPagina, FranjaMetricas, Section, StatCard } from '../ui';
import { formatPrice } from '../helpers';
import { useAjustesPedido } from './reposicion/useAjustesPedido';
import { MinimosModal, type Gama } from './reposicion/MinimosModal';
import type { GuardedFetch } from '../types';

interface Fila {
  id: number; nombre: string; tipo: string; unidad: string;
  gama: string | null;
  stock: number; minimo: number; minimo_heredado: boolean;
  consumo_diario: number; sugerido: number;
  base: 'consumo' | 'minimo';
  costo_promedio: number; costo_estimado: number;
}

interface Datos {
  esencias: Fila[]; implementos: Fila[];
  sin_historial: boolean; dias_historial: number; dias_cobertura: number;
  costo_total: number;
}


const cantidad = (n: number, unidad: string) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${unidad === 'ml' ? 'ml' : 'u'}`;

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
export function ReposicionTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
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
        guardedFetch(`${BASE_URL}/api/inventario/reposicion`),
        guardedFetch(`${BASE_URL}/api/costeo/gamas/todas`),
      ]);
      if (!rRepo.ok) { setError('No se pudo cargar el pedido sugerido'); return; }
      setDatos((await rRepo.json()).data);
      // Las gamas solo hacen falta para el modal de configuración; si fallan,
      // la lista de pedido se sigue viendo
      if (rGamas.ok) setGamas((await rGamas.json()).data ?? []);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }, [guardedFetch]);

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

  const Tabla = ({ titulo, filas, nota }: { titulo: string; filas: Fila[]; nota: string }) => {
    // Lo quitado sale de la tabla pero NO desaparece: se lista abajo para poder
    // devolverlo. Dejar caer algo en silencio es justo lo que no se hace aquí.
    const visibles = filas.filter((f) => !ajustes.estaQuitado(f.id));
    const fuera = filas.filter((f) => ajustes.estaQuitado(f.id));

    return (
    <Section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-medium text-foreground">{titulo} ({visibles.length})</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{nota}</p>
        </div>
        {visibles.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => copiar(filas)}>
            {copiado ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            Copiar la lista
          </Button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-4 text-center text-[12.5px] text-muted-foreground">
          {filas.length === 0 ? 'Nada por pedir aquí.' : 'Sacaste todo de esta lista.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-136 border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3 font-semibold">Material</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Te queda</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Mínimo</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Pide</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Te costará</th>
                <th className="py-1.5 font-semibold"><span className="sr-only">Sacar</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 pr-3 text-foreground">
                    {f.nombre}
                    {f.gama && <span className="block text-[11px] text-muted-foreground">{f.gama}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-destructive">
                    {cantidad(f.stock, f.unidad)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {cantidad(f.minimo, f.unidad)}
                    {f.minimo_heredado && (
                      <span className="block text-[10.5px]">de su gama</span>
                    )}
                  </td>
                  {/* La cantidad se teclea: el sistema propone, el dueño decide.
                      Debajo se sigue diciendo de dónde salía el número sugerido,
                      y si lo cambió, cuál era — para poder volver sin recargar. */}
                  <td className="py-1.5 pr-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Input
                        type="number" min="0" step="any"
                        aria-label={`Cuánto pedir de ${f.nombre}`}
                        className="h-8 w-24 text-right text-[12.5px] tabular-nums"
                        value={ajustes.cantidadDe(f.id, f.sugerido)}
                        onChange={(e) => ajustes.fijarCantidad(
                          f.id, e.target.value === '' ? null : Number(e.target.value))}
                      />
                      <span className="w-5 text-left text-[11px] text-muted-foreground">
                        {f.unidad === 'ml' ? 'ml' : 'u'}
                      </span>
                    </div>
                    <span className="block text-[10.5px] font-normal text-muted-foreground">
                      {ajustes.fueTocado(f.id)
                        ? `sugería ${cantidad(f.sugerido, f.unidad)}`
                        : f.base === 'consumo' ? 'por lo que gastas' : 'para el colchón'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                    {formatPrice(Math.round(ajustes.cantidadDe(f.id, f.sugerido) * f.costo_promedio))}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => ajustes.quitar(f.id)}
                      aria-label={`Sacar ${f.nombre} de este pedido`}
                      title="Sacar de este pedido"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lo que se sacó sigue a la vista y se puede devolver de un clic: el
          material NO dejó de estar bajo mínimo, solo no entra en este pedido. */}
      {fuera.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-2 text-[11.5px] text-muted-foreground">
          <span>Sacaste de este pedido:</span>
          {fuera.map((f) => (
            <button
              key={f.id}
              onClick={() => ajustes.devolver(f.id)}
              className="rounded-full border border-border px-2 py-0.5 transition-colors hover:border-primary/40 hover:text-foreground"
              title="Volver a incluirlo"
            >
              {f.nombre} <span className="text-primary">+</span>
            </button>
          ))}
        </div>
      )}
    </Section>
    );
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
          guardedFetch={guardedFetch}
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

      <Tabla titulo="Esencias" filas={datos.esencias}
        nota="Lo que hay que pedirle al laboratorio" />
      <Tabla titulo="Envases, accesorios y demás" filas={datos.implementos}
        nota="Frascos, perfumeros, diluyente, sellador…" />
    </div>
  );
}
