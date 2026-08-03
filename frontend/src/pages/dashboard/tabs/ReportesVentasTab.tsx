import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import GraficoBarras, { SERIE_A, SERIE_B } from '../GraficoBarras';
import { Panel, Ranking, ReporteShell, useReporte } from '../reportes/comun';
import { formatPrice } from '../helpers';
import { FranjaMetricas, StatCard } from '../ui';
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

/**
 * `timeZone: 'UTC'` NO es opcional: la fecha se construye con Date.UTC, y al
 * formatearla en hora local (Colombia, UTC-5) el día 1 se corre al mes anterior
 * y "agosto" se lee "julio". Es el mismo tropiezo que ya documenta CLAUDE.md.
 */
const MES_LARGO = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' });

/**
 * "2026-08" → "agosto". El código del mes sirve para ordenar, no para leerlo.
 * Se construye con Date.UTC: con hora local, el día 1 se iría al mes anterior.
 */
const nombreMes = (clave: string) => {
  const [a, m] = clave.split('-').map(Number);
  if (!a || !m) return clave;
  return MES_LARGO.format(new Date(Date.UTC(a, m - 1, 1)));
};

/**
 * Variación entre el último mes de una serie y el anterior.
 * Devuelve null si no hay con qué comparar o si el mes previo fue cero: un
 * "+∞ %" no informa nada.
 */
function variacionUltimoMes(serie: { mes: string; ingresos: number }[]) {
  if (serie.length < 2) return null;
  const actual = serie[serie.length - 1];
  const previo = serie[serie.length - 2];
  if (previo.ingresos <= 0) return null;
  return {
    pct: Math.round(((actual.ingresos - previo.ingresos) / previo.ingresos) * 100),
    mesActual: nombreMes(actual.mes),
    mesPrevio: nombreMes(previo.mes),
    valorPrevio: previo.ingresos,
  };
}

const unidades = (n: number) => `${n} u`;

/** Unidades vendidas sin talla anotada (histórico y productos que no la tienen). */
const sinTalla = (d: ReporteVentas) =>
  d.por_talla.filter((t) => t.ml == null).reduce((s, t) => s + t.unidades, 0);

/** Cuánto se vendió, qué se vendió y cuánto quedó de ganancia. */
export function ReportesVentasTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const { datos, cargando, error, recargar } = useReporte<ReporteVentas>(guardedFetch, 'ventas');
  /** Cuántos meses se ven en el gráfico. Comparar 12 meses de un vistazo cansa;
      a veces solo interesa cómo va el trimestre. */
  const [meses, setMeses] = useState(12);

  const serie = datos ? datos.serie.slice(-meses) : [];
  const variacion = variacionUltimoMes(serie);

  return (
    <ReporteShell
      titulo="Reporte de ventas"
      cargando={cargando}
      error={error}
      onReintentar={recargar}
      acciones={
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          Ver
          <NativeSelect
            className="h-9 w-40"
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            aria-label="Meses a comparar"
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </NativeSelect>
        </label>
      }
    >
      {datos && (
        <div className="space-y-4">
          <FranjaMetricas>
            {/* Este número SIEMPRE son 12 meses: el selector solo recorta el
                gráfico, no el resto del reporte. Poner "(3 meses)" aquí sería
                mentir sobre lo que se está contando. */}
            <StatCard
              label="Ventas (12 meses)"
              value={datos.num_ventas}
              nota={variacion
                ? `${variacion.mesActual} va ${variacion.pct >= 0 ? '↑' : '↓'} ${Math.abs(variacion.pct)}% contra ${variacion.mesPrevio} (${formatPrice(variacion.valorPrevio)})`
                : 'Aún no hay un mes anterior con el que comparar'}
            />
            <StatCard
              label="Ticket promedio"
              value={formatPrice(datos.ticket_promedio)}
              nota="Solo sobre ventas pagadas: lo pendiente inflaría la cifra"
            />
            <StatCard
              label={datos.num_pendientes > 0
                ? `Por cobrar (${datos.num_pendientes} ${datos.num_pendientes === 1 ? 'venta' : 'ventas'})`
                : 'Por cobrar'}
              value={formatPrice(datos.valor_pendiente)}
              nota={datos.num_pendientes === 0 ? 'Todo cobrado' : 'Ventas registradas que aún no te han pagado'}
            />
          </FranjaMetricas>

          <Panel>
            <GraficoBarras
              datos={serie}
              series={[
                { clave: 'ganancia', nombre: 'Ganancia', color: SERIE_A },
                { clave: 'costo', nombre: 'Costo de lo vendido', color: SERIE_B },
              ]}
              titulo={`Ingresos por mes (últimos ${meses})`}
              formato={formatPrice}
              nota={serie.every((s) => s.costo === 0)
                ? 'Todavía no hay costo de mercancía: aparece cuando las ventas empiecen a descontar inventario (necesitan talla y el perfume con su esencia asignada).'
                : undefined}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
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
        </div>
      )}
    </ReporteShell>
  );
}
