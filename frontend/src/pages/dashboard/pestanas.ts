import { lazyPagina } from '../../utils/lazyPagina';

/**
 * LAS PESTAÑAS DEL PANEL, cada una en su propio archivo.
 *
 * Antes `DashboardPage` las importaba todas de golpe: abrir el panel para
 * registrar una venta bajaba también reportes, mayoreo, blog y cotizaciones
 * (560 kB en un solo archivo). Ahora cada una baja al abrirla y el navegador la
 * guarda para la siguiente vez.
 *
 * Van con `lazyPagina` y nunca con `lazy` a secas: tras un despliegue, un
 * teléfono con la versión vieja pediría archivos borrados y quedaría en "Algo
 * salió mal" (ver `docs/gotchas.md`, 2026-09-28). Las pestañas exportan con
 * nombre, así que se re-empaquetan como `default`.
 */
export const PerfumesTab = lazyPagina(() => import('./tabs/PerfumesTab').then((m) => ({ default: m.PerfumesTab })));
export const ProductosTab = lazyPagina(() => import('./tabs/ProductosTab').then((m) => ({ default: m.ProductosTab })));
export const CombosTab = lazyPagina(() => import('./tabs/CombosTab').then((m) => ({ default: m.CombosTab })));
export const PreciosTab = lazyPagina(() => import('./tabs/PreciosTab').then((m) => ({ default: m.PreciosTab })));
export const DescuentosTab = lazyPagina(() => import('./tabs/DescuentosTab').then((m) => ({ default: m.DescuentosTab })));
export const LookupTab = lazyPagina(() => import('./tabs/LookupTab').then((m) => ({ default: m.LookupTab })));
export const VentasTab = lazyPagina(() => import('./tabs/VentasTab').then((m) => ({ default: m.VentasTab })));
export const CreditosTab = lazyPagina(() => import('./tabs/CreditosTab').then((m) => ({ default: m.CreditosTab })));
export const InicioTab = lazyPagina(() => import('./tabs/InicioTab').then((m) => ({ default: m.InicioTab })));
export const RecompraTab = lazyPagina(() => import('./tabs/RecompraTab').then((m) => ({ default: m.RecompraTab })));
export const PagosTab = lazyPagina(() => import('./tabs/PagosTab').then((m) => ({ default: m.PagosTab })));
export const UsuariosTab = lazyPagina(() => import('./tabs/UsuariosTab').then((m) => ({ default: m.UsuariosTab })));
export const PublicidadTab = lazyPagina(() => import('./tabs/PublicidadTab').then((m) => ({ default: m.PublicidadTab })));
export const RecompensasTab = lazyPagina(() => import('./tabs/RecompensasTab').then((m) => ({ default: m.RecompensasTab })));
export const ResenasTab = lazyPagina(() => import('./tabs/ResenasTab').then((m) => ({ default: m.ResenasTab })));
export const AvisosTab = lazyPagina(() => import('./tabs/AvisosTab').then((m) => ({ default: m.AvisosTab })));
export const SobreNosotrosTab = lazyPagina(() => import('./tabs/SobreNosotrosTab').then((m) => ({ default: m.SobreNosotrosTab })));
export const BlogTab = lazyPagina(() => import('./tabs/BlogTab').then((m) => ({ default: m.BlogTab })));
export const CotizacionesTab = lazyPagina(() => import('./tabs/CotizacionesTab').then((m) => ({ default: m.CotizacionesTab })));
export const FormulasVolumenTab = lazyPagina(() => import('./tabs/FormulasVolumenTab').then((m) => ({ default: m.FormulasVolumenTab })));
export const PreciosMayoreoTab = lazyPagina(() => import('./tabs/PreciosMayoreoTab').then((m) => ({ default: m.PreciosMayoreoTab })));
export const GamasTab = lazyPagina(() => import('./tabs/GamasTab').then((m) => ({ default: m.GamasTab })));
export const CostosProduccionTab = lazyPagina(() => import('./tabs/CostosProduccionTab').then((m) => ({ default: m.CostosProduccionTab })));
export const DevolucionesTab = lazyPagina(() => import('./tabs/DevolucionesTab').then((m) => ({ default: m.DevolucionesTab })));
export const InventarioTab = lazyPagina(() => import('./tabs/InventarioTab').then((m) => ({ default: m.InventarioTab })));
export const ReposicionTab = lazyPagina(() => import('./tabs/ReposicionTab').then((m) => ({ default: m.ReposicionTab })));
export const AlertasTab = lazyPagina(() => import('./tabs/AlertasTab').then((m) => ({ default: m.AlertasTab })));
export const ProduccionesTab = lazyPagina(() => import('./tabs/ProduccionesTab').then((m) => ({ default: m.ProduccionesTab })));
export const FrascosArmadosTab = lazyPagina(() => import('./tabs/FrascosArmadosTab').then((m) => ({ default: m.FrascosArmadosTab })));
export const ReportesVentasTab = lazyPagina(() => import('./tabs/ReportesVentasTab').then((m) => ({ default: m.ReportesVentasTab })));
export const ReportesComprasTab = lazyPagina(() => import('./tabs/ReportesComprasTab').then((m) => ({ default: m.ReportesComprasTab })));
export const ReportesClientesTab = lazyPagina(() => import('./tabs/ReportesClientesTab').then((m) => ({ default: m.ReportesClientesTab })));
export const RolesTab = lazyPagina(() => import('./tabs/RolesTab').then((m) => ({ default: m.RolesTab })));
export const SolicitudesTab = lazyPagina(() => import('./tabs/SolicitudesTab').then((m) => ({ default: m.SolicitudesTab })));
export const EmpaqueTab = lazyPagina(() => import('./tabs/EmpaqueTab').then((m) => ({ default: m.EmpaqueTab })));
export const HistorialTab = lazyPagina(() => import('./tabs/HistorialTab').then((m) => ({ default: m.HistorialTab })));
export const RedesTab = lazyPagina(() => import('./tabs/RedesTab').then((m) => ({ default: m.RedesTab })));
