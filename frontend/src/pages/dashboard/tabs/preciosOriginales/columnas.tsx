import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '../../../../components/table/tableTypes';
import { formatPrice } from '../../helpers';
import { bajaPrecio, cambiaConSugerido, ESTADOS, type Desglose, type Estado, type FilaPrecio } from './filas';
import { PrecioEditable } from './PrecioEditable';
import { textoMeta } from './sugerencia';

const ESTILO_ESTADO: Record<Estado, string> = {
  'Sin precio': 'bg-amber-100 text-amber-800',
  'Bajo tu meta': 'bg-red-100 text-red-800',
  'Al día': 'bg-emerald-100 text-emerald-800',
  'Sin costo': 'bg-secondary text-muted-foreground',
};

const textoDesglose = (d: Desglose) =>
  [`Líquido ${formatPrice(d.liquido)}`, d.merma && `trasvase ${formatPrice(d.merma)}`,
    d.frasco && `frasco ${formatPrice(d.frasco)}`, d.empaque && `empaque ${formatPrice(d.empaque)}`]
    .filter(Boolean).join(' + ');

/**
 * Las columnas de Precios de originales. Reciben lo que hace cada fila
 * (guardar un precio) en vez de vivir dentro de la pantalla: un componente
 * declarado dentro de otro se desmonta en cada render y la casilla de precio
 * perdería el foco a media cifra.
 */
export const columnasPrecios = (
  guardarPrecio: (f: FilaPrecio, precio: number) => Promise<boolean>,
): ColumnDef<FilaPrecio>[] => [
  {
    key: 'perfume', header: 'Perfume · talla', type: 'string', movil: 'titulo', noTruncate: true,
    getValue: f => `${f.perfume} ${f.talla}`,
    render: f => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground" title={f.perfume}>{f.perfume}</p>
        <p className="text-[12px] text-muted-foreground">
          {f.talla}
          {f.metaPropia && <span className="text-primary"> · meta propia {textoMeta(f.metaPropia, formatPrice)}</span>}
          {!f.publicado && ' · fuera de la tienda'}
        </p>
      </div>
    ),
  },
  {
    key: 'estado', header: 'Estado', type: 'enum', enumOptions: ESTADOS, movil: 'estado',
    getValue: f => f.estado,
    render: f => <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-medium', ESTILO_ESTADO[f.estado])}>{f.estado}</span>,
  },
  {
    key: 'costo', header: 'Te cuesta', type: 'currency', filterable: false, movil: 'meta',
    getValue: f => f.costo?.total ?? null,
    render: f => (f.costo
      ? <span className="tabular-nums" title={textoDesglose(f.costo)}><span className="sm:hidden">Te cuesta </span>{formatPrice(f.costo.total)}</span>
      : <span className="text-muted-foreground" title="La botella no tiene costo de compra registrado">—</span>),
  },
  {
    key: 'precio', header: 'Precio hoy', type: 'currency', filterable: false, movil: 'detalle', noTruncate: true,
    getValue: f => f.precio,
    render: f => <PrecioEditable precio={f.precio} etiqueta={`${f.perfume}, ${f.talla}`} onGuardar={p => guardarPrecio(f, p)} />,
  },
  {
    key: 'ganancia', header: 'Ganas', type: 'currency', filterable: false, movil: 'detalle',
    getValue: f => f.ganancia?.pesos ?? null,
    render: f => (f.ganancia
      ? <span className={cn('tabular-nums', f.estado === 'Bajo tu meta' ? 'font-medium text-destructive' : 'text-foreground')}>
          {formatPrice(f.ganancia.pesos)} <span className="text-[12px] text-muted-foreground">({f.ganancia.porcentaje} %)</span>
        </span>
      : <span className="text-muted-foreground">—</span>),
  },
  {
    key: 'sugerido', header: 'Sugerido', type: 'currency', filterable: false, movil: 'destacado', noTruncate: true,
    getValue: f => f.sugerido,
    render: f => (f.sugerido == null ? <span className="text-muted-foreground">—</span> : (
      <span className="inline-flex items-center gap-2">
        <span className={cn('tabular-nums font-semibold', cambiaConSugerido(f) ? 'text-primary' : 'text-foreground')}>{formatPrice(f.sugerido)}</span>
        {bajaPrecio(f) && <span className="text-[11.5px] text-amber-700">baja</span>}
        {cambiaConSugerido(f) && (
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-[12px]"
            aria-label={`Usar ${formatPrice(f.sugerido)} en ${f.perfume}, ${f.talla}`}
            onClick={() => guardarPrecio(f, f.sugerido!)}>
            Usar
          </Button>
        )}
      </span>
    )),
  },
];
