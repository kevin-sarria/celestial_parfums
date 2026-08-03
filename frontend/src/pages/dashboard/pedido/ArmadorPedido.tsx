import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import BuscadorSelect from '../../../components/BuscadorSelect';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { formatPrice } from '../helpers';
import { precioUnitario, unidadesDeLineas, type LineaPedido } from './lineasPedido';

interface ArmadorPedidoProps {
  lineas: LineaPedido[];
  onChange: (lineas: LineaPedido[]) => void;
  catalogo: Perfume[];
  /** Índice por id; lo arma quien lo usa una sola vez con useMemo. */
  porId: Map<number, Perfume>;
  /** Solo Créditos: check por línea para quitar el descuento de la página. */
  permitirSinDescuento?: boolean;
  /** Solo Ventas: da de alta un producto que no está en el catálogo. */
  onCrearProducto?: () => void;
  /** Texto del buscador. */
  placeholder?: string;
}

/**
 * El editor de líneas del pedido: un producto, su talla y cuántas van.
 *
 * Lo comparten Ventas y Créditos. La talla se elige de `perfume.precios[]`, que
 * trae la etiqueta y el número de ml juntos: por eso elegirla fija las dos cosas
 * a la vez y no hay forma de que se desincronicen.
 */
export function ArmadorPedido({
  lineas, onChange, catalogo, porId,
  permitirSinDescuento, onCrearProducto,
  placeholder = 'Buscar y agregar producto…',
}: ArmadorPedidoProps) {
  const unidades = unidadesDeLineas(lineas);

  /** Las tallas de un perfume, con su ml. Vacío = producto sin talla. */
  const tallasDe = (p: Perfume | undefined) => p?.precios ?? [];

  /** Agrega el producto; si ya está con la misma talla, le suma una unidad. */
  const agregar = (id: number) => {
    const p = porId.get(id);
    if (!p) return;
    const primera = tallasDe(p)[0];
    const presentacion = primera?.presentacion ?? null;
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
      siguientes[gemela] = { ...siguientes[gemela], cantidad: siguientes[gemela].cantidad + actual.cantidad };
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
          ...catalogo.map(p => ({ id: p.id, nombre: p.nombre })),
        ]}
        placeholder={placeholder}
        vacio="Sin productos en el catálogo"
        onSelect={id => {
          if (String(id) === 'nuevo') onCrearProducto?.();
          else agregar(Number(id));
        }}
      />

      {lineas.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {lineas.map(l => {
            const p = porId.get(l.perfume_id);
            const tallas = tallasDe(p);
            const descuento = p?.descuento ?? 0;
            return (
              <li
                key={l.key}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-2"
              >
                <span className="min-w-32 flex-1 text-[13px] font-medium text-foreground">
                  {p?.nombre ?? l.nombre ?? `#${l.perfume_id}`}
                </span>

                {/* Un producto sin tallas (una gorra) no muestra selector */}
                {tallas.length > 0 && (
                  <NativeSelect
                    className="h-8 w-26 text-[12.5px]"
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
                    {tallas.map(t => (
                      <option key={t.presentacion} value={t.presentacion}>{t.presentacion}</option>
                    ))}
                  </NativeSelect>
                )}

                <Input
                  type="number" min="1" value={l.cantidad}
                  className="h-8 w-16 text-[12.5px]"
                  aria-label="Cantidad"
                  onChange={e => actualizar(l.key, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                />

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

                <span className="w-24 text-right text-[12.5px] font-semibold tabular-nums text-foreground">
                  {formatPrice(precioUnitario(l, porId) * l.cantidad)}
                </span>

                <button
                  type="button" aria-label="Quitar"
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => quitar(l.key)}
                >
                  <X className="size-3.5" />
                </button>
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
