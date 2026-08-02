import GraficoBarras, { SERIE_A, SERIE_B } from '../GraficoBarras';
import { Panel, Ranking, ReporteShell, useReporte } from '../reportes/comun';
import { formatPrice } from '../helpers';
import { StatCard, StatRow } from '../ui';
import type { GuardedFetch } from '../types';

interface ReporteCompras {
  serie: { mes: string; compras: number; envios: number; total: number }[];
  total_gastado: number;
  total_envios: number;
  num_compras: number;
  por_proveedor: { nombre: string; total: number; compras: number }[];
  por_insumo: { nombre: string; unidad: string; cantidad: number; total: number }[];
}

/** Cuánto salió hacia proveedores y en qué se fue. */
export function ReportesComprasTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const { datos, cargando, error, recargar } = useReporte<ReporteCompras>(guardedFetch, 'compras');

  return (
    <ReporteShell titulo="Reporte de compras" cargando={cargando} error={error} onReintentar={recargar}>
      {datos && (
        <>
          <StatRow>
            <StatCard label="Comprado (12 meses)" value={formatPrice(datos.total_gastado)} />
            <StatCard label="Pagado en envíos" value={formatPrice(datos.total_envios)} />
            <StatCard label="Pedidos a proveedores" value={datos.num_compras} />
          </StatRow>

          {/* Sin esta aclaración, ver "gasté más de lo que vendí" asusta sin
              motivo: buena parte de esa plata sigue en bodega como mercancía. */}
          <p className="mt-3 rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            Esto es lo que <strong className="text-foreground">salió</strong> hacia proveedores, no
            una pérdida: lo que todavía no se ha vendido sigue siendo tuyo, guardado como mercancía.
          </p>

          <div className="mt-4">
            <Panel>
              <GraficoBarras
                datos={datos.serie}
                series={[
                  { clave: 'compras', nombre: 'Mercancía', color: SERIE_A },
                  { clave: 'envios', nombre: 'Envíos', color: SERIE_B },
                ]}
                titulo="Compras por mes (últimos 12)"
                formato={formatPrice}
              />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Ranking
              titulo="A quién le compras más"
              filas={datos.por_proveedor.map((p) => ({
                nombre: p.nombre,
                valor: p.total,
                detalle: `${p.compras} ${p.compras === 1 ? 'pedido' : 'pedidos'}`,
              }))}
              formato={formatPrice}
              vacio="Todavía no hay pagos a proveedores registrados."
              color={SERIE_A}
            />
            <Ranking
              titulo="En qué insumos se va la plata"
              filas={datos.por_insumo.map((i) => ({
                nombre: i.nombre,
                valor: i.total,
                detalle: `${i.cantidad} ${i.unidad}`,
              }))}
              formato={formatPrice}
              vacio="Aparece cuando registres las compras detalladas en Inventario."
              color={SERIE_B}
            />
          </div>
        </>
      )}
    </ReporteShell>
  );
}
