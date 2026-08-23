import {
  SprayCan, Flower2, CalendarDays, Tags, Ruler, Gift, BadgePercent,
  CircleDollarSign, ClipboardList, Factory, Share2, Users, Megaphone, Star, MessageSquareText,
  BellRing, ShoppingCart, Info, Newspaper, FileText, FlaskConical, Boxes, Calculator, PackageX,
  ChartColumn, Layers, Coins, type LucideIcon,
} from 'lucide-react';
import type { Tab } from './types';

/**
 * EL MAPA DEL DASHBOARD: cómo se llama cada apartado y en qué grupo vive.
 *
 * Vive aparte de la página y del menú porque lo usan los dos: la página para
 * el título y la etiqueta de arriba, el menú para pintarse. Tenerlo dentro de
 * cualquiera de ellos obligaba al otro a importarlo desde ahí, y eso cerraba
 * un círculo entre archivos.
 */

export const TAB_META: Record<Tab, { label: string; icon: LucideIcon }> = {
  perfumes: { label: 'Perfumes', icon: SprayCan },
  aromas: { label: 'Aromas', icon: Flower2 },
  ocasiones: { label: 'Ocasiones', icon: CalendarDays },
  categorias: { label: 'Categorias', icon: Tags },
  presentaciones: { label: 'Presentaciones', icon: Ruler },
  gamas: { label: 'Gamas de esencia', icon: Layers },
  combos: { label: 'Combos', icon: Gift },
  precios: { label: 'Precios', icon: Tags },
  descuentos: { label: 'Descuentos', icon: BadgePercent },
  ventas: { label: 'Ventas', icon: CircleDollarSign },
  creditos: { label: 'Creditos', icon: ClipboardList },
  devoluciones: { label: 'Devoluciones', icon: PackageX },
  pagos: { label: 'Proveedores', icon: Factory },
  inventario: { label: 'Inventario', icon: Boxes },
  reposicion: { label: 'Pedido sugerido', icon: ShoppingCart },
  producciones: { label: 'Producciones', icon: FlaskConical },
  rep_ventas: { label: 'Reporte de ventas', icon: ChartColumn },
  rep_compras: { label: 'Reporte de compras', icon: ChartColumn },
  rep_clientes: { label: 'Reporte de clientes', icon: ChartColumn },
  usuarios: { label: 'Usuarios', icon: Users },
  publicidad: { label: 'Publicidad', icon: Megaphone },
  recompensas: { label: 'Recompensas', icon: Star },
  resenas: { label: 'Reseñas', icon: MessageSquareText },
  avisos: { label: 'Reposiciones', icon: BellRing },
  nosotros: { label: 'Sobre nosotros', icon: Info },
  blog: { label: 'Blog', icon: Newspaper },
  redes: { label: 'Redes sociales', icon: Share2 },
  cotizaciones: { label: 'Cotizaciones', icon: FileText },
  precios_mayoreo: { label: 'Precios al mayoreo', icon: Coins },
  formulas: { label: 'Tamaños y fórmulas', icon: FlaskConical },
  costos: { label: 'Costos de producción', icon: Calculator },
};

// Menú del dashboard agrupado en secciones colapsables (drawer con burger)
export const NAV_SECTIONS: { id: string; label: string; tabs: Tab[] }[] = [
  { id: 'catalogo', label: 'Catálogo', tabs: ['perfumes', 'combos', 'precios', 'descuentos'] },
  { id: 'clasificaciones', label: 'Clasificaciones', tabs: ['aromas', 'ocasiones', 'categorias', 'presentaciones', 'gamas'] },
  /**
   * DOS grupos, no uno. Lo señaló el dueño cuando "Ventas y créditos" llegó a
   * ocho pestañas: *"una cosa es la parte contable —lo que se vende, lo que
   * sale, lo que se devuelve— y otra muy diferente las fórmulas y demás, que no
   * es el core de las ventas sino más de operaciones o de reglas"*.
   *
   * Y tenía razón: mezclaba PLATA (ventas, créditos, devoluciones, lo que se le
   * paga al proveedor) con OPERACIÓN (qué tengo, qué armé, con qué receta,
   * cuánto me cuesta, qué pedir). Se busca con cabezas distintas.
   */
  { id: 'negocio', label: 'Ventas y créditos', tabs: ['ventas', 'creditos', 'devoluciones', 'pagos'] },
  /**
   * Las RECETAS y el costo de producción viven aquí, no en Mayoreo: de ellas
   * salen los materiales que descuenta cada venta y cada lote, así que las usa
   * todo el negocio. Mayoreo solo cotiza, y para eso las lee.
   */
  { id: 'operacion', label: 'Producción e inventario', tabs: ['inventario', 'reposicion', 'producciones', 'formulas', 'costos'] },
  { id: 'mayoreo', label: 'Mayoreo B2B', tabs: ['cotizaciones', 'precios_mayoreo'] },
  { id: 'reportes', label: 'Reportes', tabs: ['rep_ventas', 'rep_compras', 'rep_clientes'] },
  { id: 'cuentas', label: 'Personas y página', tabs: ['usuarios', 'publicidad', 'recompensas', 'resenas', 'avisos', 'nosotros', 'blog', 'redes'] },
];

export const sectionOfTab = (tab: Tab) =>
  NAV_SECTIONS.find(s => s.tabs.includes(tab))?.id ?? NAV_SECTIONS[0].id;

export const TAB_POR_DEFECTO: Tab = 'perfumes';
export const esTabValido = (t?: string): t is Tab => !!t && Object.prototype.hasOwnProperty.call(TAB_META, t);

