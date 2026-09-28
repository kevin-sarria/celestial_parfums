import {
  SprayCan, PackageCheck, Package, Flower2, CalendarDays, Tags, Ruler, Gift, BadgePercent,
  CircleDollarSign, ClipboardList, Factory, Share2, Users, Megaphone, Star, MessageSquareText,
  BellRing, ShoppingCart, Info, Newspaper, FileText, FlaskConical, Boxes, Calculator, PackageX,
  ChartColumn, Layers, Coins, TriangleAlert, House, Repeat, type LucideIcon,
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
  inicio: { label: 'Inicio', icon: House },
  perfumes: { label: 'Perfumes', icon: SprayCan },
  productos: { label: 'Productos', icon: PackageCheck },
  aromas: { label: 'Aromas', icon: Flower2 },
  ocasiones: { label: 'Ocasiones', icon: CalendarDays },
  categorias: { label: 'Categorías', icon: Tags },
  presentaciones: { label: 'Presentaciones', icon: Ruler },
  gamas: { label: 'Gamas de esencia', icon: Layers },
  combos: { label: 'Combos', icon: Gift },
  precios: { label: 'Precios', icon: Tags },
  descuentos: { label: 'Descuentos', icon: BadgePercent },
  ventas: { label: 'Ventas', icon: CircleDollarSign },
  creditos: { label: 'Créditos', icon: ClipboardList },
  recompra: { label: 'Recompra', icon: Repeat },
  devoluciones: { label: 'Devoluciones', icon: PackageX },
  pagos: { label: 'Compras a proveedores', icon: Factory },
  inventario: { label: 'Inventario', icon: Boxes },
  armados: { label: 'Frascos armados', icon: Package },
  reposicion: { label: 'Pedido sugerido', icon: ShoppingCart },
  alertas: { label: 'Alertas de inventario', icon: TriangleAlert },
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
  /**
   * Orden del menú = orden del día del dueño (reorganizado el 2026-09-28, tras
   * revisar el panel entero): primero lo que se toca todos los días —vender,
   * cobrar, a quién escribirle—, después el taller, el catálogo y los números,
   * y al final lo que se toca de vez en cuando (la página, los ajustes, el
   * mayoreo, que el dueño usará cuando el negocio crezca).
   *
   * Se conservan dos decisiones anteriores del dueño:
   * - PLATA y OPERACIÓN van separadas (2026-08-10): *"una cosa es la parte
   *   contable —lo que se vende, lo que sale, lo que se devuelve— y otra muy
   *   diferente las fórmulas y demás"*. Por eso las compras a proveedores
   *   siguen con la plata, y las recetas con el taller.
   * - Las RECETAS y el costo de producción viven en el taller, no en Ajustes
   *   ni en Mayoreo: de ellas salen los materiales que descuenta cada venta y
   *   cada lote. Mayoreo solo cotiza, y para eso las lee.
   *
   * Criterio para una pestaña nueva: si la pregunta es "cuánto dinero", va a
   * Ventas y créditos; si es "cómo lo hago o con qué", al taller; si se
   * configura una vez y se olvida, a Ajustes.
   */
  { id: 'negocio', label: 'Ventas y créditos', tabs: ['ventas', 'creditos', 'recompra', 'devoluciones', 'pagos'] },
  { id: 'operacion', label: 'Producción e inventario', tabs: ['producciones', 'armados', 'inventario', 'reposicion', 'alertas', 'formulas', 'costos'] },
  { id: 'catalogo', label: 'Catálogo', tabs: ['perfumes', 'productos', 'combos', 'precios', 'descuentos'] },
  { id: 'reportes', label: 'Reportes', tabs: ['rep_ventas', 'rep_compras', 'rep_clientes'] },
  { id: 'pagina', label: 'Página web', tabs: ['publicidad', 'recompensas', 'resenas', 'avisos', 'nosotros', 'blog', 'redes'] },
  // `aromas` es la puerta a las cinco clasificaciones (ver CLASIFICACIONES)
  { id: 'ajustes', label: 'Ajustes', tabs: ['usuarios', 'aromas'] },
  { id: 'mayoreo', label: 'Mayoreo B2B', tabs: ['cotizaciones', 'precios_mayoreo'] },
];

/**
 * Inicio va suelto, arriba de los grupos: es la portada del panel, no un
 * apartado de ninguno. Por eso no abre ninguna sección.
 */
export const TAB_INICIO: Tab = 'inicio';

/**
 * Las cinco listas que se configuran una vez y se olvidan. En el menú son UNA
 * entrada ("Clasificaciones", que abre la primera) y arriba de cada una hay
 * pestañas para pasar a las otras (2026-09-28). Cada lista conserva su propia
 * dirección, así que los enlaces y los recorridos de siempre siguen sirviendo.
 */
export const CLASIFICACIONES: Tab[] = ['aromas', 'ocasiones', 'categorias', 'presentaciones', 'gamas'];
export const esClasificacion = (t: Tab) => CLASIFICACIONES.includes(t);

/** Lo que dice el menú para una pestaña: la de las clasificaciones se llama por su grupo. */
export const etiquetaEnMenu = (t: Tab) => (t === CLASIFICACIONES[0] ? 'Clasificaciones' : TAB_META[t].label);

/** ¿Esta entrada del menú está activa estando en `actual`? */
export const entradaActiva = (t: Tab, actual: Tab) =>
  t === actual || (t === CLASIFICACIONES[0] && esClasificacion(actual));

export const sectionOfTab = (tab: Tab) =>
  NAV_SECTIONS.find(s => s.tabs.some(t => entradaActiva(t, tab)))?.id ?? '';

/** Al entrar al panel se cae en Inicio (antes era la lista de Perfumes, 2026-09-28). */
export const TAB_POR_DEFECTO: Tab = TAB_INICIO;
export const esTabValido = (t?: string): t is Tab => !!t && Object.prototype.hasOwnProperty.call(TAB_META, t);

