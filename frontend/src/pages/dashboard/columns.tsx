import { Link2 as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import type { ColumnDef } from '../../components/table/tableTypes';
import type { Venta, Credito, Pago } from './types';
import { formatPrice, fmtDate } from './helpers';
import { finalPrice } from '@/lib/format';

/** Clases reutilizables para celdas. */
const cellName = 'whitespace-nowrap font-medium text-foreground';
const cellPrice = 'whitespace-nowrap font-semibold tabular-nums text-foreground';
const cellMeta = 'whitespace-nowrap text-muted-foreground';

const SubText = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-normal text-muted-foreground">{children}</div>
);

export const ventasColumns: ColumnDef<Venta>[] = [
  { key: 'dia', header: 'Dia', type: 'date', getValue: v => v.dia.slice(0, 10), render: v => fmtDate(v.dia), className: cellMeta, noTruncate: true },
  { key: 'persona', header: 'Persona', type: 'string', getValue: v => v.persona,
    render: v => (
      <span>
        {v.persona}
        {v.user && (
          <SubText>
            <span className="inline-flex items-center gap-1 text-primary">
              <LinkIcon className="size-3" /> {v.user.nombre} {v.user.apellido}
            </span>
          </SubText>
        )}
      </span>
    ),
    className: cellName },
  { key: 'cantidad_perfumes', header: 'Cant.', type: 'number', getValue: v => v.cantidad_perfumes, className: cellMeta, noTruncate: true },
  { key: 'presentacion', header: 'Presentacion', type: 'enum', enumOptions: ['10ML', '20ML', '30ML', '60ML', '100ML', '200ML'],
    getValue: v => v.presentacion,
    render: v => <Badge variant="outline" className="border-primary/30 bg-brand-soft text-primary">{v.presentacion}</Badge>,
    className: cellMeta, noTruncate: true },
  { key: 'referencia_perfume', header: 'Referencia', type: 'string', getValue: v => v.referencia_perfume,
    render: v => (
      <span>
        {v.referencia_perfume}
        {v.perfumes.length > 0 && (
          <SubText>
            <span className="inline-flex items-center gap-1 text-primary">
              <LinkIcon className="size-3" />{' '}
              {v.perfumes.map(p => (p.cantidad > 1 ? `${p.cantidad}× ${p.nombre}` : p.nombre)).join(' · ')}
            </span>
          </SubText>
        )}
      </span>
    ) },
  { key: 'valor_venta', header: 'Valor', type: 'currency', getValue: v => v.valor_venta,
    render: v => (
      <span>
        {formatPrice(v.valor_venta)}
        {v.codigo && (
          <SubText>
            <span className="text-primary">🎟 {v.codigo.codigo} (-{v.codigo.descuento_pct}%)</span>
          </SubText>
        )}
      </span>
    ),
    className: cellPrice, noTruncate: true },
  { key: 'pagada', header: 'Pago', type: 'enum', enumOptions: ['Pagada', 'Pendiente'],
    getValue: v => (v.pagada ? 'Pagada' : 'Pendiente'),
    render: v => v.pagada
      ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-600">Pagada</Badge>
      : <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-600">Pendiente</Badge>,
    noTruncate: true },
  { key: 'datos_adicionales', header: 'Datos adicionales', type: 'string', getValue: v => v.datos_adicionales ?? '',
    render: v => <>{v.datos_adicionales ?? '—'}</> },
];

export const creditosColumns: ColumnDef<Credito>[] = [
  { key: 'fecha', header: 'Fecha', type: 'date', getValue: c => c.fecha.slice(0, 10), render: c => fmtDate(c.fecha), className: cellMeta, noTruncate: true },
  { key: 'cliente', header: 'Cliente', type: 'string',
    getValue: c => `${c.cliente.nombre} ${c.cliente.apellido}`,
    render: c => (
      <span>
        {c.cliente.nombre} {c.cliente.apellido}
        {c.cliente.correo && <SubText>{c.cliente.correo}</SubText>}
      </span>
    ), className: cellName },
  { key: 'telefono', header: 'Telefono', type: 'string', getValue: c => c.cliente.telefono ?? '', render: c => c.cliente.telefono ?? '—', className: cellMeta, noTruncate: true },
  { key: 'articulos', header: 'Articulos', type: 'string', getValue: c => c.articulos },
  { key: 'deuda_inicial', header: 'Deuda inicial', type: 'currency', getValue: c => c.deuda_inicial, render: c => formatPrice(c.deuda_inicial), className: cellPrice, noTruncate: true },
  { key: 'total_abonado', header: 'Abonado', type: 'currency',
    getValue: c => c.total_abonado,
    render: c => formatPrice(c.total_abonado),
    className: cellPrice, noTruncate: true },
  { key: 'total_en_deuda', header: 'En deuda', type: 'currency', getValue: c => c.total_en_deuda,
    render: c => (
      <span className={c.total_en_deuda > 0 ? 'font-bold text-destructive' : 'font-bold text-emerald-600'}>
        {formatPrice(c.total_en_deuda)}
      </span>
    ),
    className: cellPrice, noTruncate: true },
];

export const pagosColumns: ColumnDef<Pago>[] = [
  { key: 'dia', header: 'Dia', type: 'date', getValue: p => p.dia.slice(0, 10), render: p => fmtDate(p.dia), className: cellMeta, noTruncate: true },
  { key: 'empresa', header: 'Empresa', type: 'string',
    getValue: p => p.empresa.nombre,
    render: p => (
      <span>
        {p.empresa.nombre}
        {p.empresa.nit && <SubText>NIT: {p.empresa.nit}</SubText>}
      </span>
    ), className: cellName },
  { key: 'valor_compra', header: 'Valor compra', type: 'currency', getValue: p => p.valor_compra, render: p => formatPrice(p.valor_compra), className: cellPrice, noTruncate: true },
  { key: 'coste_envio', header: 'Costo envio', type: 'currency', getValue: p => p.coste_envio,
    render: p => p.coste_envio > 0 ? formatPrice(p.coste_envio) : '—', className: cellPrice, noTruncate: true },
  { key: 'detalles_adicionales', header: 'Detalles', type: 'string', getValue: p => p.detalles_adicionales ?? '',
    render: p => <>{p.detalles_adicionales ?? '—'}</> },
];

export const perfumesColumns: ColumnDef<Perfume>[] = [
  { key: 'nombre', header: 'Nombre', type: 'string', getValue: p => p.nombre, className: cellName },
  { key: 'precio', header: 'Precio', type: 'currency', getValue: p => p.precio, render: p => formatPrice(p.precio), className: cellPrice, noTruncate: true },
  { key: 'genero', header: 'Genero', type: 'enum', enumOptions: ['dama', 'caballero', 'unisex'], getValue: p => p.genero ?? '', render: p => p.genero ?? '—', className: cellMeta, noTruncate: true },
  { key: 'categoria', header: 'Categoria', type: 'string', getValue: p => p.categoria ?? '', render: p => p.categoria ?? '—', className: cellMeta, noTruncate: true },
  { key: 'tipos_aroma', header: 'Aromas', type: 'string',
    getValue: p => p.tipos_aroma.join(', '),
    render: p => (
      <div className="flex max-w-56 flex-wrap gap-1">
        {p.tipos_aroma.map(a => <Badge key={a} variant="secondary" className="font-normal">{a}</Badge>)}
      </div>
    ),
    sortable: false, noTruncate: true },
  { key: 'duracion', header: 'Duracion', type: 'string', getValue: p => p.duracion ?? '', render: p => p.duracion ?? '—', className: cellMeta, noTruncate: true },
  // El estado de stock se muestra (y se cambia) con el badge interactivo de las acciones de la fila.
];

export const combosColumns: ColumnDef<Combo>[] = [
  { key: 'nombre', header: 'Nombre', type: 'string', getValue: c => c.nombre,
    render: c => (
      <span>
        {c.nombre}
        {c.descripcion && <SubText>{c.descripcion}</SubText>}
      </span>
    ),
    className: cellName },
  { key: 'cantidad', header: 'Perfumes', type: 'number', getValue: c => c.cantidad,
    render: c => (
      <span>
        {c.cantidad} perfumes
        {(c.categoria || c.presentacion) && (
          <SubText>{[c.categoria, c.presentacion ?? 'cualquier tamaño'].filter(Boolean).join(' · ')}</SubText>
        )}
      </span>
    ),
    className: cellMeta, noTruncate: true },
  { key: 'precio', header: 'Precio', type: 'currency', getValue: c => c.precio, render: c => formatPrice(c.precio), className: cellPrice, noTruncate: true },
  { key: 'descuento', header: 'Descuento', type: 'number', getValue: c => c.descuento, render: c => c.descuento > 0 ? `${c.descuento}%` : '—', className: cellMeta, noTruncate: true },
  { key: 'precio_final', header: 'Precio final', type: 'currency',
    getValue: c => finalPrice(c.precio, c.descuento),
    render: c => c.descuento > 0 ? formatPrice(finalPrice(c.precio, c.descuento)) : '—',
    className: cellPrice, noTruncate: true },
  { key: 'activo', header: 'Estado', type: 'enum', enumOptions: ['Activo', 'Inactivo'],
    getValue: c => c.activo ? 'Activo' : 'Inactivo',
    render: c => c.activo
      ? <Badge variant="outline" className="border-primary/30 bg-brand-soft text-primary">Activo</Badge>
      : <Badge variant="secondary" className="text-muted-foreground">Inactivo</Badge>,
    noTruncate: true },
];
