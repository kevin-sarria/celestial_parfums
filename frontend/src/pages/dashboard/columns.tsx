import { Link2 as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import type { ColumnDef } from '../../components/table/tableTypes';
import type { Venta, Credito, Pago, InventarioInsumo, Produccion, FrascoArmado } from './types';
import { formatPrice, fmtDate } from './helpers';
import { EstadoPerfume, faltaParaVender } from './tabs/perfumes/EstadoPerfume';
import { finalPrice } from '@/lib/format';

/** Clases reutilizables para celdas. */
const cellName = 'whitespace-nowrap font-medium text-foreground';
const cellPrice = 'whitespace-nowrap font-semibold tabular-nums text-foreground';
const cellMeta = 'whitespace-nowrap text-muted-foreground';

const SubText = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-normal text-muted-foreground">{children}</div>
);

/**
 * La foto del producto como COLUMNA, no colgada de las acciones.
 *
 * El hueco vacío se dibuja igual cuando no hay foto: si la celda quedara en
 * blanco, la columna se vería rota y además no se distingue "no tiene foto" de
 * "la foto no cargó" — y una ficha sin foto es justo lo que hay que cazar.
 */
const Miniatura = ({ url, alt }: { url?: string | null; alt: string }) => (
  url
    ? <img src={url} alt={alt} loading="lazy"
        className="size-8 rounded-md border border-border object-cover" />
    : <span aria-label="Sin foto" title="Sin foto"
        className="block size-8 rounded-md border border-dashed border-border bg-secondary/40" />
);

/** Columna de foto, igual en todas las tablas que tienen producto. */
const columnaImagen = <T,>(url: (row: T) => string | null | undefined, alt: (row: T) => string): ColumnDef<T> => ({
  key: 'imagen', header: 'Imagen', type: 'string',
  getValue: row => (url(row) ? 'con foto' : 'sin foto'),
  render: row => <Miniatura url={url(row)} alt={alt(row)} />,
  sortable: false, filterable: false, noTruncate: true, className: 'w-0',
});

export const ventasColumns: ColumnDef<Venta>[] = [
  { key: 'dia', header: 'Dia', type: 'date', getValue: v => v.dia.slice(0, 10), render: v => fmtDate(v.dia), className: cellMeta, noTruncate: true, movil: 'meta' },
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
    className: cellName, movil: 'titulo' },
  { key: 'cantidad_perfumes', header: 'Cant.', type: 'number', getValue: v => v.cantidad_perfumes, className: cellMeta, noTruncate: true },
  { key: 'presentacion', header: 'Presentacion', type: 'enum', enumOptions: ['10ML', '20ML', '30ML', '60ML', '100ML', '200ML'],
    getValue: v => v.presentacion,
    render: v => <Badge variant="outline" className="border-border bg-brand-soft text-primary">{v.presentacion}</Badge>,
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
    className: cellPrice, noTruncate: true, movil: 'destacado' },
  { key: 'pagada', header: 'Pago', type: 'enum', enumOptions: ['Pagada', 'Pendiente'],
    getValue: v => (v.pagada ? 'Pagada' : 'Pendiente'),
    render: v => v.pagada
      ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-600">Pagada</Badge>
      : <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-600">Pendiente</Badge>,
    noTruncate: true, movil: 'estado' },
  { key: 'datos_adicionales', header: 'Datos adicionales', type: 'string', getValue: v => v.datos_adicionales ?? '',
    render: v => <>{v.datos_adicionales ?? '—'}</> },
];

export const creditosColumns: ColumnDef<Credito>[] = [
  { key: 'fecha', header: 'Fecha', type: 'date', getValue: c => c.fecha.slice(0, 10), render: c => fmtDate(c.fecha), className: cellMeta, noTruncate: true, movil: 'meta' },
  { key: 'cliente', header: 'Cliente', type: 'string',
    getValue: c => `${c.cliente.nombre} ${c.cliente.apellido}`,
    render: c => (
      <span>
        {c.cliente.nombre} {c.cliente.apellido}
        {c.cliente.correo && <SubText>{c.cliente.correo}</SubText>}
      </span>
    ), className: cellName, movil: 'titulo' },
  { key: 'telefono', header: 'Telefono', type: 'string', getValue: c => c.cliente.telefono ?? '', render: c => c.cliente.telefono ?? '—', className: cellMeta, noTruncate: true },
  { key: 'articulos', header: 'Articulos', type: 'string', getValue: c => c.articulos,
    render: c => (
      <span>
        {c.articulos}
        {c.codigo && <SubText>Cupón {c.codigo.codigo} (−{c.codigo.descuento_pct}%)</SubText>}
      </span>
    ) },
  // Acuerdo de pago: se resalta en rojo cuando ya venció con saldo pendiente
  { key: 'fecha_limite', header: 'Límite', type: 'date',
    getValue: c => c.fecha_limite?.slice(0, 10) ?? '',
    render: c => c.fecha_limite
      ? (c.vencido
          ? <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-600">Vencido · {fmtDate(c.fecha_limite)}</Badge>
          : <span className={cellMeta}>{fmtDate(c.fecha_limite)}</span>)
      : <>—</>,
    noTruncate: true, movil: 'estado' },
  { key: 'deuda_inicial', header: 'Deuda inicial', type: 'currency', getValue: c => c.deuda_inicial, render: c => formatPrice(c.deuda_inicial), className: cellPrice, noTruncate: true },
  // Sin filtro: se calculan de los abonos de cada crédito, no son una columna
  // que el servidor pueda comparar sin traer y sumar TODOS los créditos antes
  // (ver el comentario en credito.repository.ts).
  { key: 'total_abonado', header: 'Abonado', type: 'currency',
    getValue: c => c.total_abonado,
    render: c => formatPrice(c.total_abonado),
    className: cellPrice, noTruncate: true, filterable: false },
  { key: 'total_en_deuda', header: 'En deuda', type: 'currency', getValue: c => c.total_en_deuda,
    render: c => (
      <span className={c.total_en_deuda > 0 ? 'font-bold text-destructive' : 'font-bold text-emerald-600'}>
        {formatPrice(c.total_en_deuda)}
      </span>
    ),
    className: cellPrice, noTruncate: true, movil: 'destacado', filterable: false },
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

/**
 * Inventario de insumos.
 *
 * "Existencias" es la columna que se mira primero (por eso es `destacado` en la
 * tarjeta de celular) y se pinta en ámbar cuando toca el punto de pedido o
 * llega a cero: es el aviso de que hay que encargar antes de quedarse sin
 * material a mitad de una producción.
 */
export const inventarioColumns: ColumnDef<InventarioInsumo>[] = [
  // El tipo NO se repite bajo el nombre: tiene su propia columna, que además filtra.
  { key: 'nombre', header: 'Insumo', type: 'string', getValue: i => i.nombre,
    render: i => (
      <span className={i.activo ? undefined : 'text-muted-foreground'}>
        {i.nombre}
        {/* Un apagado sigue en la lista para poder reencenderlo, pero tiene que
            distinguirse o parece que sigue en uso. */}
        {!i.activo && (
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            apagado
          </span>
        )}
      </span>
    ), className: cellName, movil: 'titulo' },
  { key: 'tipo', header: 'Tipo', type: 'enum', getValue: i => i.tipo.replace('_', ' '),
    enumOptions: ['materia prima', 'envase', 'accesorio'], filterable: true,
    className: cellMeta, movil: 'meta' },
  // Filtrable a propósito: es la forma de repasar "muéstrame las árabes" y
  // cazar las que quedaron sin clasificar, que son las que el costeo por gama
  // ignora en silencio.
  { key: 'gama', header: 'Gama', type: 'string',
    getValue: i => i.gama_nombre ?? '—', filterable: true,
    className: cellMeta, movil: 'meta' },
  { key: 'stock', header: 'Existencias', type: 'number', getValue: i => i.stock,
    render: i => (
      <span className={i.bajo_minimo || i.stock <= 0 ? 'font-medium text-amber-700' : undefined}>
        {i.stock} {i.unidad}
      </span>
    ), sortable: true, className: 'whitespace-nowrap text-right tabular-nums text-foreground', noTruncate: true, movil: 'destacado' },
  { key: 'stock_minimo', header: 'Minimo', type: 'number', getValue: i => i.stock_minimo,
    render: i => <>{i.stock_minimo > 0 ? i.stock_minimo : '—'}</>,
    sortable: true, className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', noTruncate: true },
  { key: 'costo_promedio', header: 'Costo promedio', type: 'currency', getValue: i => i.costo_promedio,
    render: i => formatPrice(i.costo_promedio), sortable: true,
    className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', noTruncate: true },
  { key: 'valor', header: 'Valor', type: 'currency', getValue: i => i.valor,
    render: i => formatPrice(i.valor), sortable: true,
    className: `text-right ${cellPrice}`, noTruncate: true, movil: 'meta' },
];

/**
 * Frascos que YA están armados, esperando venta.
 *
 * Es inventario tan real como el material, y hasta el 2026-08-14 no se veía en
 * ninguna pantalla: la plata salía de los insumos al producir y no aparecía en
 * ningún lado. El costo es el del día que se armó, congelado.
 */
export const terminadoColumns: ColumnDef<FrascoArmado>[] = [
  { key: 'perfume', header: 'Perfume', type: 'string', getValue: f => f.perfume,
    className: cellName, movil: 'titulo' },
  { key: 'talla', header: 'Talla', type: 'string', getValue: f => f.talla,
    filterable: true, className: cellMeta, movil: 'meta' },
  { key: 'cantidad', header: 'Frascos', type: 'number', getValue: f => f.cantidad,
    render: f => (
      // Un negativo significa que se vendió algo que no estaba armado (o que se
      // borró un lote ya vendido): hay que mirarlo, no esconderlo.
      <span className={f.cantidad < 0 ? 'font-medium text-destructive' : undefined}>
        {f.cantidad}
      </span>
    ), sortable: true, className: 'whitespace-nowrap text-right tabular-nums text-foreground',
    noTruncate: true, movil: 'destacado' },
  { key: 'costo_unitario', header: 'Costo c/u', type: 'currency', getValue: f => f.costo_unitario,
    render: f => formatPrice(f.costo_unitario), sortable: true,
    className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', noTruncate: true },
  { key: 'valor', header: 'Valor', type: 'currency', getValue: f => f.valor,
    render: f => formatPrice(f.valor), sortable: true,
    className: `text-right ${cellPrice}`, noTruncate: true, movil: 'meta' },
];

/** Lotes armados. El costo por unidad sale de los insumos que se consumieron. */
export const produccionesColumns: ColumnDef<Produccion>[] = [
  { key: 'fecha', header: 'Fecha', type: 'date', getValue: p => p.fecha.slice(0, 10),
    render: p => fmtDate(p.fecha), className: cellMeta, noTruncate: true, movil: 'meta' },
  { key: 'lote', header: 'Lote', type: 'string',
    getValue: p => `${p.perfume_nombre ?? ''} ${p.volumen_nombre}`.trim(),
    render: p => (
      <span>
        {p.cantidad} × {p.perfume_nombre ? `${p.perfume_nombre} ${p.volumen_nombre}` : p.volumen_nombre}
        {/* La última corrección, dicha en la fila: sin esto, un lote corregido
            se ve idéntico a uno que siempre dijo eso. */}
        {p.historial.length > 0 && (
          <span className="block max-w-[42ch] truncate text-[11.5px] font-normal text-muted-foreground"
            title={p.historial.map(h => `${fmtDate(h.fecha)} · ${h.texto}`).join('\n')}>
            ✎ editado el {fmtDate(p.historial[0].fecha)} · {p.historial[0].texto}
          </span>
        )}
      </span>
    ), className: cellName, movil: 'titulo' },
  { key: 'costo_unitario', header: 'Costo c/u', type: 'currency', getValue: p => p.costo_unitario,
    render: p => (
      <span>
        {formatPrice(p.costo_unitario)}
        {p.costo_manual && <span title="Costo puesto a mano" className="ml-1 text-primary">✎</span>}
      </span>
    ), sortable: true,
    className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', noTruncate: true },
  { key: 'costo_total', header: 'Costo total', type: 'currency', getValue: p => p.costo_total,
    render: p => formatPrice(p.costo_total), sortable: true,
    className: `text-right ${cellPrice}`, noTruncate: true, movil: 'destacado' },
];

export const perfumesColumns: ColumnDef<Perfume>[] = [
  columnaImagen<Perfume>(p => p.imagen_url, p => p.nombre),
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
  /**
   * ESTADO: solo se marca lo que no está normal (fuera de la tienda, agotado,
   * sin esencia). Es columna propia —con su encabezado— y no un añadido colgado
   * de las acciones: así se puede ORDENAR y FILTRAR por ella, que es como se
   * repasa "muéstrame lo que está fuera" en una tabla de 212 filas.
   */
  // Sin filtro: combina publicado, agotado manual y `faltaParaVender` — una
  // regla del navegador sin traducción directa a un WHERE del servidor.
  { key: 'estado', header: 'Estado', type: 'string',
    getValue: p => [
      p.publicado ? '' : 'Fuera de la tienda',
      p.agotado_manual ? 'Agotado' : '',
      faltaParaVender(p)?.etiqueta ?? '',
    ].filter(Boolean).join(', ') || 'En la tienda',
    render: p => <EstadoPerfume perfume={p} />,
    noTruncate: true, filterable: false },
];

/**
 * PRODUCTOS: lo que existe antes de venderse.
 *
 * Sin aromas ni duración: un accesorio no los tiene y un 1.1 los hereda de su
 * fragancia. A cambio entran las dos que aquí sí se miran a diario — de qué
 * clase es y cuántas unidades quedan.
 */
/**
 * Cuántas unidades quedan de un producto, según cómo se consigue.
 *
 * Null = no se puede saber (un comprado al que todavía no se le asignó su
 * material). Se devuelve null y no cero: cero diría "no tengo", y lo cierto es
 * "no lo sé" — marcar un agotado inventado escondería cosas que sí se tienen.
 */
const unidadesDeProducto = (p: Perfume): number | null => {
  if (p.solo_armado) return p.frascos_armados;
  if (p.tipo_producto === 'comprado' || p.es_accesorio) return p.producto_stock;
  return p.frascos_armados;
};

export const productosColumns: ColumnDef<Perfume>[] = [
  columnaImagen<Perfume>(p => p.imagen_url, p => p.nombre),
  { key: 'nombre', header: 'Nombre', type: 'string', getValue: p => p.nombre, className: cellName },
  // El TIPO se deduce, no se guarda. El orden importa: un accesorio SIEMPRE es
  // comprado, así que preguntar por `es_accesorio` primero es lo que evita que
  // se pierda lo único que lo distingue.
  { key: 'tipo', header: 'Tipo', type: 'string',
    getValue: p => (p.solo_armado ? '1.1' : p.es_accesorio ? 'Accesorio' : 'Comprado'),
    className: cellMeta, noTruncate: true, filterable: false },
  { key: 'precio', header: 'Precio', type: 'currency', getValue: p => p.precio,
    render: p => formatPrice(p.precio), className: cellPrice, noTruncate: true },
  { key: 'categoria', header: 'Categoria', type: 'string', getValue: p => p.categoria ?? '',
    render: p => p.categoria ?? '—', className: cellMeta, noTruncate: true },
  /**
   * CUÁNTAS UNIDADES QUEDAN, que es lo que esta pantalla no decía.
   *
   * El número no significa lo mismo en cada familia, así que se dice cuál es:
   * un 1.1 se cuenta por FRASCOS ARMADOS —solo se vende lo que ya está hecho— y
   * un comprado por las unidades del material que ES el producto.
   *
   * No cuesta una consulta más: los dos datos ya viajaban en la respuesta del
   * catálogo. Era la razón por la que esta columna llevaba dos olas esperando.
   */
  { key: 'stock', header: 'Unidades', type: 'number',
    getValue: p => unidadesDeProducto(p) ?? -1,
    render: p => {
      const n = unidadesDeProducto(p);
      if (n === null) return <span className={cellMeta}>—</span>;
      return (
        <span className={n <= 0 ? 'font-medium text-destructive' : undefined}>
          {n}
          <SubText>{p.solo_armado || !p.es_accesorio ? 'armadas' : 'en bodega'}</SubText>
        </span>
      );
    },
    className: cellMeta, noTruncate: true, filterable: false },
  { key: 'estado', header: 'Estado', type: 'string',
    getValue: p => [
      p.publicado ? '' : 'Fuera de la tienda',
      p.agotado_manual ? 'Agotado' : '',
      faltaParaVender(p)?.etiqueta ?? '',
    ].filter(Boolean).join(', ') || 'En la tienda',
    render: p => <EstadoPerfume perfume={p} />,
    noTruncate: true, filterable: false },
];

export const combosColumns: ColumnDef<Combo>[] = [
  columnaImagen<Combo>(c => c.imagen_url, c => c.nombre),
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
  // Sin filtro: es `precio × (1 − descuento/100)`, una cuenta que el
  // servidor no puede meter en un WHERE sin SQL crudo (ver combo.repository.ts).
  { key: 'precio_final', header: 'Precio final', type: 'currency',
    getValue: c => finalPrice(c.precio, c.descuento),
    render: c => c.descuento > 0 ? formatPrice(finalPrice(c.precio, c.descuento)) : '—',
    className: cellPrice, noTruncate: true, filterable: false },
  { key: 'activo', header: 'Estado', type: 'enum', enumOptions: ['Activo', 'Inactivo'],
    getValue: c => c.activo ? 'Activo' : 'Inactivo',
    render: c => c.activo
      ? <Badge variant="outline" className="border-border bg-brand-soft text-primary">Activo</Badge>
      : <Badge variant="secondary" className="text-muted-foreground">Inactivo</Badge>,
    noTruncate: true },
];
