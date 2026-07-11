import type { Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import type { ColumnDef } from '../../components/table/tableTypes';
import type { Venta, Credito, Pago } from './types';
import { formatPrice, fmtDate } from './helpers';

export const ventasColumns: ColumnDef<Venta>[] = [
  { key: 'dia', header: 'Dia', type: 'date', getValue: v => v.dia.slice(0, 10), render: v => fmtDate(v.dia), className: 'dash-td-meta', noTruncate: true },
  { key: 'persona', header: 'Persona', type: 'string', getValue: v => v.persona, className: 'dash-td-name' },
  { key: 'cantidad_perfumes', header: 'Cant.', type: 'number', getValue: v => v.cantidad_perfumes, className: 'dash-td-meta', noTruncate: true },
  { key: 'presentacion', header: 'Presentacion', type: 'enum', enumOptions: ['10ML', '20ML', '30ML', '60ML', '100ML', '200ML'],
    getValue: v => v.presentacion, render: v => <span className="dash-tag dash-tag--oc">{v.presentacion}</span>, className: 'dash-td-meta', noTruncate: true },
  { key: 'referencia_perfume', header: 'Referencia', type: 'string', getValue: v => v.referencia_perfume },
  { key: 'valor_venta', header: 'Valor', type: 'currency', getValue: v => v.valor_venta, render: v => formatPrice(v.valor_venta), className: 'dash-td-price', noTruncate: true },
  { key: 'datos_adicionales', header: 'Datos adicionales', type: 'string', getValue: v => v.datos_adicionales ?? '',
    render: v => <>{v.datos_adicionales ?? '—'}</> },
];

export const creditosColumns: ColumnDef<Credito>[] = [
  { key: 'fecha', header: 'Fecha', type: 'date', getValue: c => c.fecha.slice(0, 10), render: c => fmtDate(c.fecha), className: 'dash-td-meta', noTruncate: true },
  { key: 'cliente', header: 'Cliente', type: 'string',
    getValue: c => `${c.cliente.nombre} ${c.cliente.apellido}`,
    render: c => (
      <span>
        {c.cliente.nombre} {c.cliente.apellido}
        {c.cliente.correo && <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 400 }}>{c.cliente.correo}</div>}
      </span>
    ), className: 'dash-td-name' },
  { key: 'telefono', header: 'Telefono', type: 'string', getValue: c => c.cliente.telefono ?? '', render: c => c.cliente.telefono ?? '—', className: 'dash-td-meta', noTruncate: true },
  { key: 'articulos', header: 'Articulos', type: 'string', getValue: c => c.articulos },
  { key: 'deuda_inicial', header: 'Deuda inicial', type: 'currency', getValue: c => c.deuda_inicial, render: c => formatPrice(c.deuda_inicial), className: 'dash-td-price', noTruncate: true },
  { key: 'total_abonado', header: 'Abonado', type: 'currency',
    getValue: c => c.total_abonado,
    render: c => formatPrice(c.total_abonado),
    className: 'dash-td-price', noTruncate: true },
  { key: 'total_en_deuda', header: 'En deuda', type: 'currency', getValue: c => c.total_en_deuda,
    render: c => <span style={{ color: c.total_en_deuda > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{formatPrice(c.total_en_deuda)}</span>,
    className: 'dash-td-price', noTruncate: true },
];

export const pagosColumns: ColumnDef<Pago>[] = [
  { key: 'dia', header: 'Dia', type: 'date', getValue: p => p.dia.slice(0, 10), render: p => fmtDate(p.dia), className: 'dash-td-meta', noTruncate: true },
  { key: 'empresa', header: 'Empresa', type: 'string',
    getValue: p => p.empresa.nombre,
    render: p => (
      <span>
        {p.empresa.nombre}
        {p.empresa.nit && <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 400 }}>NIT: {p.empresa.nit}</div>}
      </span>
    ), className: 'dash-td-name' },
  { key: 'valor_compra', header: 'Valor compra', type: 'currency', getValue: p => p.valor_compra, render: p => formatPrice(p.valor_compra), className: 'dash-td-price', noTruncate: true },
  { key: 'coste_envio', header: 'Costo envio', type: 'currency', getValue: p => p.coste_envio,
    render: p => p.coste_envio > 0 ? formatPrice(p.coste_envio) : '—', className: 'dash-td-price', noTruncate: true },
  { key: 'detalles_adicionales', header: 'Detalles', type: 'string', getValue: p => p.detalles_adicionales ?? '',
    render: p => <>{p.detalles_adicionales ?? '—'}</> },
];

export const perfumesColumns: ColumnDef<Perfume>[] = [
  { key: 'nombre', header: 'Nombre', type: 'string', getValue: p => p.nombre, className: 'dash-td-name' },
  { key: 'precio', header: 'Precio', type: 'currency', getValue: p => p.precio, render: p => formatPrice(p.precio), className: 'dash-td-price', noTruncate: true },
  { key: 'genero', header: 'Genero', type: 'enum', enumOptions: ['hombre', 'mujer'], getValue: p => p.genero ?? '', render: p => p.genero ?? '—', className: 'dash-td-meta', noTruncate: true },
  { key: 'categoria', header: 'Categoria', type: 'string', getValue: p => p.categoria ?? '', render: p => p.categoria ?? '—', className: 'dash-td-meta', noTruncate: true },
  { key: 'tipos_aroma', header: 'Aromas', type: 'string',
    getValue: p => p.tipos_aroma.join(', '),
    render: p => <div className="dash-tags">{p.tipos_aroma.map(a => <span key={a} className="dash-tag">{a}</span>)}</div>,
    sortable: false, noTruncate: true },
  { key: 'duracion', header: 'Duracion', type: 'string', getValue: p => p.duracion ?? '', render: p => p.duracion ?? '—', className: 'dash-td-meta', noTruncate: true },
  { key: 'agotado', header: 'Stock', type: 'enum', enumOptions: ['En stock', 'Agotado'],
    getValue: p => p.agotado ? 'Agotado' : 'En stock',
    filterable: false, sortable: false, noTruncate: true },
];

export const combosColumns: ColumnDef<Combo>[] = [
  { key: 'nombre', header: 'Nombre', type: 'string', getValue: c => c.nombre,
    render: c => <span>{c.nombre}{c.descripcion && <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 400 }}>{c.descripcion}</div>}</span>,
    className: 'dash-td-name' },
  { key: 'cantidad', header: 'Perfumes', type: 'number', getValue: c => c.cantidad, render: c => `${c.cantidad} perfumes`, className: 'dash-td-meta', noTruncate: true },
  { key: 'precio', header: 'Precio', type: 'currency', getValue: c => c.precio, render: c => formatPrice(c.precio), className: 'dash-td-price', noTruncate: true },
  { key: 'descuento', header: 'Descuento', type: 'number', getValue: c => c.descuento, render: c => c.descuento > 0 ? `${c.descuento}%` : '—', className: 'dash-td-meta', noTruncate: true },
  { key: 'precio_final', header: 'Precio final', type: 'currency',
    getValue: c => c.descuento > 0 ? Math.round(c.precio * (1 - c.descuento / 100)) : c.precio,
    render: c => c.descuento > 0 ? formatPrice(Math.round(c.precio * (1 - c.descuento / 100))) : '—',
    className: 'dash-td-price', noTruncate: true },
  { key: 'activo', header: 'Estado', type: 'enum', enumOptions: ['Activo', 'Inactivo'],
    getValue: c => c.activo ? 'Activo' : 'Inactivo',
    render: c => <span className={`dash-tag ${c.activo ? 'dash-tag--oc' : ''}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>,
    noTruncate: true },
];
