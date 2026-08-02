import GraficoBarras, { SERIE_A, SERIE_B } from '../GraficoBarras';
import { Panel, Ranking, ReporteShell, useReporte } from '../reportes/comun';
import { formatPrice } from '../helpers';
import { StatCard, StatRow } from '../ui';
import type { GuardedFetch } from '../types';

interface ReporteVentas {
  serie: { mes: string; ingresos: number; costo: number; ganancia: number }[];
  ticket_promedio: number;
  num_ventas: number;
  num_pagadas: number;
  num_pendientes: number;
  valor_pendiente: number;
  a_credito: number;
  top_productos: { perfume_id: number; nombre: string; unidades: number }[];
  por_talla: { ml: number | null; unidades: number }[];
}

const unidades = (n: number) => `${n} u`;

/** Unidades vendidas sin talla anotada (histórico y productos que no la tienen). */
const sinTalla = (d: ReporteVentas) =>
  d.por_talla.filter((t) => t.ml == null).reduce((s, t) => s + t.unidades, 0);

/** Cuánto se vendió, qué se vendió y cuánto quedó de ganancia. */
export function ReportesVentasTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const { datos, cargando, error, recargar } = useReporte<ReporteVentas>(guardedFetch, 'ventas');

  return (
    <ReporteShell titulo="Reporte de ventas" cargando={cargando} error={error} onReintentar={recargar}>
      {datos && (
        <>
          <StatRow>
            <StatCard label="Ventas (12 meses)" value={datos.num_ventas} />
            <StatCard label="Ticket promedio" value={formatPrice(datos.ticket_promedio)} />
            {datos.num_pendientes > 0 && (
              <StatCard
                label={`Por cobrar (${datos.num_pendientes} ${datos.num_pendientes === 1 ? 'venta' : 'ventas'})`}
                value={formatPrice(datos.valor_pendiente)}
              />
            )}
          </StatRow>

          <div className="mt-5">
            <Panel>
              <GraficoBarras
                datos={datos.serie}
                series={[
                  { clave: 'ganancia', nombre: 'Ganancia', color: SERIE_A },
                  { clave: 'costo', nombre: 'Costo de lo vendido', color: SERIE_B },
                ]}
                titulo="Ingresos por mes (últimos 12)"
                formato={formatPrice}
                nota={datos.serie.every((s) => s.costo === 0)
                  ? 'Todavía no hay costo de mercancía: aparece cuando las ventas empiecen a descontar inventario (necesitan talla y el perfume con su esencia asignada).'
                  : undefined}
              />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Ranking
              titulo="Los más vendidos"
              filas={datos.top_productos.map((p) => ({ nombre: p.nombre, valor: p.unidades }))}
              formato={unidades}
              vacio="Todavía no hay ventas enlazadas a productos del catálogo."
              color={SERIE_A}
            />
            {/* `ml` en null son ventas viejas (no guardaban la talla) o productos
                que no la tienen, como una gorra. Se dejan FUERA del ranking: una
                sola barra gigante llamada "sin talla" no compara nada. */}
            <Ranking
              titulo="Unidades por talla"
              filas={datos.por_talla
                .filter((t) => t.ml != null)
                .map((t) => ({ nombre: `${t.ml} ml`, valor: t.unidades }))}
              formato={unidades}
              vacio={`Las ventas registradas hasta ahora (${sinTalla(datos)} unidades) no guardaban la talla. Este ranking se llena solo a medida que registres ventas eligiendo el tamaño de cada producto.`}
              color={SERIE_B}
            />
          </div>
        </>
      )}
    </ReporteShell>
  );
}
