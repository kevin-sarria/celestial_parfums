import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import BuscadorSelect from '../../../components/BuscadorSelect';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { formatPrice } from '../helpers';
import { precioUnitario, unidadesCobradas, unidadesDeLineas, type LineaPedido } from './lineasPedido';

interface ArmadorPedidoProps {
  lineas: LineaPedido[];
  onChange: (lineas: LineaPedido[]) => void;
  catalogo: Perfume[];
  /** Índice por id; lo arma quien lo usa una sola vez con useMemo. */
  porId: Map<number, Perfume>;
  /** Solo Créditos: check por línea para quitar el descuento de la página. */
  permitirSinDescuento?: boolean;
  /**
   * Agrega el buscador de accesorios y el campo "Regalo" por línea. La usan
   * Ventas y Créditos: desde el 2026-08-24 el crédito guarda las dos cosas,
   * porque su venta pasa por el mismo camino que una venta normal.
   */
  permitirExtras?: boolean;
  /** Solo Ventas: da de alta un producto que no está en el catálogo. */
  onCrearProducto?: () => void;
  /** Texto del buscador. */
  placeholder?: string;
}

/**
 * Alto de los controles de una línea: el normal en el celular (dedo) y el
 * compacto desde `sm`. La letra NO se toca: la de fábrica de `Input` y del
 * desplegable (`text-base md:text-sm`) es la misma, y bajar de 16px en el
 * celular hace que Safari del iPhone acerque la pantalla al tocar el campo.
 */
const CONTROL = 'h-9 sm:h-8';

/**
 * El editor de líneas del pedido: un producto, su talla y cuántas van.
 *
 * Lo comparten Ventas y Créditos. La talla se elige de `perfume.precios[]`, que
 * trae la etiqueta y el número de ml juntos: por eso elegirla fija las dos cosas
 * a la vez y no hay forma de que se desincronicen.
 */
export function ArmadorPedido({
  lineas, onChange, catalogo, porId,
  permitirSinDescuento, permitirExtras, onCrearProducto,
  placeholder = 'Buscar y agregar producto…',
}: ArmadorPedidoProps) {
  const unidades = unidadesDeLineas(lineas);

  /**
   * Sin `permitirExtras` el buscador de siempre sigue mostrando TODO el
   * catálogo: separar los accesorios solo tiene sentido cuando hay un segundo
   * buscador que los recoja. Sin él quedarían invisibles.
   */
  const fragancias = permitirExtras ? catalogo.filter(p => !p.es_accesorio) : catalogo;
  const accesorios = permitirExtras ? catalogo.filter(p => p.es_accesorio) : [];

  /** Las tallas de un perfume, con su ml. Vacío = producto sin talla. */
  const tallasDe = (p: Perfume | undefined) => p?.precios ?? [];

  /** Agrega el producto; si ya está con la misma talla, le suma una unidad. */
  const agregar = (id: number) => {
    const p = porId.get(id);
    if (!p) return;
    const primera = tallasDe(p)[0];
    const presentacion = primera?.presentacion ?? null;
    // Fusión simple: el mismo producto y la misma talla son UNA línea. Con el
    // regalo como número dentro de esa misma línea ya no hace falta el guarda
    // que antes evitaba mezclarla con la línea-regalo aparte.
    const i = lineas.findIndex(l => l.perfume_id === id && l.presentacion === presentacion);
    if (i >= 0) {
      onChange(lineas.map((l, k) => (k === i ? { ...l, cantidad: l.cantidad + 1 } : l)));
      return;
    }
    onChange([...lineas, {
      key: `${id}-${presentacion ?? 'sin'}-${Date.now()}`,
      perfume_id: id,
      nombre: p.nombre,
      presentacion,
      ml: primera?.ml ?? null,
      cantidad: 1,
      regalo: 0,
      sin_descuento: false,
    }]);
  };

  /**
   * Cambia una línea y, si al hacerlo queda idéntica a otra, las FUSIONA.
   * Sin esto la misma referencia aparece dos veces y el conteo miente.
   */
  const actualizar = (key: string, cambios: Partial<LineaPedido>) => {
    let siguientes = lineas.map(l => (l.key === key ? { ...l, ...cambios } : l));
    const idx = siguientes.findIndex(l => l.key === key);
    const actual = siguientes[idx];
    const gemela = siguientes.findIndex(
      (l, i) => i !== idx && l.perfume_id === actual.perfume_id && l.presentacion === actual.presentacion,
    );
    if (gemela >= 0) {
      // Al fusionar se suman las dos mitades: las unidades y las regaladas.
      siguientes[gemela] = {
        ...siguientes[gemela],
        cantidad: siguientes[gemela].cantidad + actual.cantidad,
        regalo: siguientes[gemela].regalo + actual.regalo,
      };
      siguientes = siguientes.filter((_, i) => i !== idx);
    }
    onChange(siguientes);
  };

  const quitar = (key: string) => onChange(lineas.filter(l => l.key !== key));

  return (
    <div className="space-y-2">
      <BuscadorSelect
        opciones={[
          ...(onCrearProducto ? [{ id: 'nuevo', nombre: '+ Crear producto nuevo (no está en el catálogo)' }] : []),
          ...fragancias.map(p => ({ id: p.id, nombre: p.nombre })),
        ]}
        placeholder={placeholder}
        vacio="Sin productos en el catálogo"
        onSelect={id => {
          if (String(id) === 'nuevo') onCrearProducto?.();
          else agregar(Number(id));
        }}
      />

      {/* Si todavía no hay ninguna ficha marcada como accesorio, el buscador no
          se pinta: un campo sin nada que ofrecer es solo ruido en la pantalla. */}
      {permitirExtras && accesorios.length > 0 && (
        <BuscadorSelect
          opciones={accesorios.map(p => ({ id: p.id, nombre: p.nombre }))}
          placeholder="Buscar y agregar accesorio (perfumero, bolsa, tarjeta…)"
          vacio="Sin accesorios en el catálogo"
          onSelect={id => agregar(Number(id))}
        />
      )}

      {lineas.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {lineas.map(l => {
            const p = porId.get(l.perfume_id);
            const tallas = tallasDe(p);
            const descuento = p?.descuento ?? 0;
            return (
              /**
               * En el celular, dos pisos: arriba QUÉ es y cuánto vale, abajo los
               * controles con el mismo alto y la misma letra. En una sola tira
               * con `flex-wrap` cada control caía donde le cupiera —el regalo
               * solo en otra línea, el precio flotando en la mitad— y cada campo
               * medía distinto (dueño, 2026-09-27, en su iPhone).
               *
               * Desde `sm` los dos envoltorios son `contents`: sus hijos vuelven
               * a ser una sola fila, y `order` devuelve el precio y la ✕ al final.
               */
              <li
                key={l.key}
                className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <div className="flex items-center gap-2 sm:contents">
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-foreground sm:min-w-32">
                    {p?.nombre ?? l.nombre ?? `#${l.perfume_id}`}
                    {l.regalo > 0 && (
                      <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-primary/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
                        {l.regalo === l.cantidad ? 'Regalo' : `${l.regalo} regalo`}
                      </span>
                    )}
                  </span>

                  <span className="text-right text-[12.5px] font-semibold tabular-nums text-foreground sm:order-2 sm:w-24">
                    {formatPrice(precioUnitario(l, porId) * unidadesCobradas(l))}
                  </span>

                  <button
                    type="button" aria-label="Quitar"
                    className="rounded p-1 text-muted-foreground hover:text-destructive sm:order-3"
                    onClick={() => quitar(l.key)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:contents">
                {/* Un producto sin tallas (una gorra) no muestra selector */}
                {tallas.length > 0 && (
                  <SelectSimple
                    className={`${CONTROL} min-w-0 flex-1 sm:w-26 sm:flex-none`}
                    value={l.presentacion ?? ''}
                    aria-label="Talla"
                    onChange={e => {
                      const elegida = tallas.find(t => t.presentacion === e.target.value);
                      // La etiqueta y el ml salen de la MISMA entrada: van siempre juntos
                      actualizar(l.key, {
                        presentacion: elegida?.presentacion ?? null,
                        ml: elegida?.ml ?? null,
                      });
                    }}
                  >
                    {/* Un 1.1 sin frascos de ESA talla se puede vender igual
                        —la venta ya ocurrió— pero se dice aquí y en la respuesta
                        del servidor, en vez de dejar que el sistema fabrique uno
                        con la esencia. */}
                    {tallas.map(t => (
                      <option key={t.presentacion} value={t.presentacion}>
                        {t.presentacion}
                        {p?.solo_armado && t.armados <= 0 ? ' · sin armar' : ''}
                      </option>
                    ))}
                  </SelectSimple>
                )}

                {/* En el celular la cantidad lleva su palabra: un "1" suelto al
                    lado de la talla no dice qué es. En el escritorio no hacía falta. */}
                <label className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <span className="sm:hidden">cant.</span>
                  <Input
                    type="number" min="1" value={l.cantidad}
                    className={`${CONTROL} w-16`}
                    aria-label="Cantidad"
                    onChange={e => {
                      const cantidad = Math.max(1, Number(e.target.value) || 1);
                      // El regalo nunca puede quedar por encima de la cantidad nueva.
                      actualizar(l.key, { cantidad, regalo: Math.min(l.regalo, cantidad) });
                    }}
                  />
                </label>

                {permitirExtras && (
                  <label
                    className="flex items-center gap-1 text-[11.5px] text-muted-foreground"
                    title="Cuántas de estas unidades van sin cobrar"
                  >
                    regalo
                    <Input
                      type="number" min="0" max={l.cantidad} value={l.regalo}
                      className={`${CONTROL} w-16 sm:w-14`}
                      aria-label="Regalo"
                      onChange={e => actualizar(l.key, {
                        regalo: Math.min(l.cantidad, Math.max(0, Number(e.target.value) || 0)),
                      })}
                    />
                  </label>
                )}

                {permitirSinDescuento && descuento > 0 && (
                  <label
                    className="flex cursor-pointer items-center gap-1 text-[11.5px] text-muted-foreground"
                    title="Quitar el descuento de la página en esta línea"
                  >
                    <input
                      type="checkbox" className="size-3.5 accent-primary"
                      checked={l.sin_descuento}
                      onChange={e => actualizar(l.key, { sin_descuento: e.target.checked })}
                    />
                    sin −{descuento}%
                  </label>
                )}
                </div>
              </li>
            );
          })}

          <li className="pt-0.5 text-right text-[12px] text-muted-foreground">
            {unidades} {unidades === 1 ? 'unidad' : 'unidades'} en total
          </li>
        </ul>
      )}
    </div>
  );
}
