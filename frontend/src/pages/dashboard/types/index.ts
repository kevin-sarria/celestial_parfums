/**
 * Las formas que usa el dashboard, repartidas por área.
 *
 * Estaban las 37 en un solo archivo de 517 líneas, mezclando ventas, bodega,
 * catálogo, clientes y publicidad. Nadie lo leía entero: se le agregaba al
 * final, y buscar "dónde le sumo un campo a Venta" era un Ctrl+F.
 *
 * Este índice re-exporta todo tal cual, así que **quien ya importaba desde
 * `../types` no cambia nada** — pero al ir a la definición cae en el archivo de
 * su área. Al agregar un tipo nuevo, va al área que le toque, no aquí.
 */

export * from './pedidos';
export * from './compras';
export * from './catalogo';
export * from './clientes';
export * from './publicidad';

/** Cada pestaña del dashboard. Vive aquí porque las cruza todas. */
export type Tab = 'perfumes' | 'aromas' | 'ocasiones' | 'categorias' | 'presentaciones' | 'gamas' | 'combos' | 'precios' | 'descuentos' | 'ventas' | 'creditos' | 'pagos' | 'usuarios' | 'publicidad' | 'recompensas' | 'resenas' | 'avisos' | 'nosotros' | 'blog' | 'redes' | 'cotizaciones' | 'precios_mayoreo' | 'formulas' | 'costos' | 'devoluciones' | 'inventario' | 'producciones' | 'reposicion' | 'rep_ventas' | 'rep_compras' | 'rep_clientes';
