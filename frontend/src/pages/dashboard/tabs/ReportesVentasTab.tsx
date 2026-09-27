import { useState } from 'react';
import GraficoBarras, { SERIE_A } from '../GraficoBarras';
import { Panel, Ranking, ReporteShell, useReporte } from '../reportes/comun';
import { RangoFechas, rangoPorDefecto, type Rango } from '../reportes/ventas/RangoFechas';
import { Ganancia, TablaMeses, dineroOSinDatos } from '../reportes/ventas/TablaMeses';
import { PanelPerdidas } from '../reportes/ventas/PanelPerdidas';
import type { ReporteVentasRango } from '../reportes/ventas/tipos';
import { formatPrice } from '../helpers';
import { FranjaMetricas, StatCard } from '../ui';

const unidades = (n: number) => `${n} u`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Reporte de ventas entre dos fechas: cuánto se vendió, cuánto costó, cuánto
 * quedó, cuánto se invirtió y cuánto se perdió.
 *
 * Rediseñado el 2026-09-27 a pedido del dueño (*"como un dashboard
 * profesional"*), con sus definiciones: **vendido** es solo lo pagado por
 * completo, lo demás va a **en deuda**, y donde no hay costo dice **"sin
 * datos"**. El cálculo vive en el servidor (`reporteVentasRango`); aquí solo
 * se pinta.
 */
export function ReportesVentasTab() {
  const [rango, setRango] = useState<Rango>(rangoPorDefecto);
  const { datos, cargando, error, recargar } = useReporte<ReporteVentasRango>('ventas', { ...rango });

  const v = datos?.ventas;
  const inv = datos?.invertido;

  return (
    <ReporteShell
      titulo="Reporte de ventas"
      // Al cambiar de fechas se deja lo anterior a la vista en vez de volver al
      // spinner: la pantalla no salta y el cambio se nota al llegar.
      cargando={cargando && !datos}
      error={error}
      onReintentar={recargar}
    >
      <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
        <RangoFechas valor={rango} onCambio={setRango} />

        {datos && v && inv && (
          <>
            <FranjaMetricas>
              <StatCard label="Unidades vendidas" value={String(v.unidades)}
                nota={`${plural(v.num_ventas, 'venta pagada', 'ventas pagadas')}`
                  + (v.regalos > 0 ? ` · ${plural(v.regalos, 'regalo', 'regalos')}` : '')} />
              <StatCard label="Vendido" value={formatPrice(v.vendido)}
                nota={v.num_ventas ? `Solo lo pagado por completo · ticket promedio ${formatPrice(v.ticket_promedio)}` : 'Solo lo pagado por completo'} />
              <StatCard label="En deuda" value={formatPrice(v.en_deuda)}
                nota={v.num_en_deuda
                  ? `${plural(v.num_en_deuda, 'venta', 'ventas')} (${plural(v.unidades_en_deuda, 'unidad', 'unidades')}) sin terminar de pagar`
                  : 'Nada pendiente de estas fechas'} />
              <StatCard label="Costo de lo vendido" value={dineroOSinDatos(v.costo)}
                nota={v.sin_costo.num
                  ? `${plural(v.sin_costo.num, 'venta', 'ventas')} (${formatPrice(v.sin_costo.valor)}) sin costo registrado`
                  : 'Lo que costó fabricar lo vendido'} />
              <StatCard label="Ganancia" value={<Ganancia valor={v.ganancia} cobertura={v.cobertura_pct} />}
                nota={v.margen_pct != null
                  ? `Vendido menos su costo · margen ${v.margen_pct.toLocaleString('es-CO')} %`
                  : 'Vendido menos su costo'} />
              <StatCard label="Invertido" value={formatPrice(inv.total)}
                nota={`${plural(inv.num, 'compra', 'compras')} a proveedores · ${formatPrice(inv.envios)} en envíos`} />
            </FranjaMetricas>

            {/* Pasa casi todos los meses (medido el 2026-09-27): sin esta línea,
                "invertí más de lo que vendí" se lee como pérdida y no lo es. */}
            {inv.total > v.vendido && (
              <p className="rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
                Compraste {formatPrice(inv.total - v.vendido)} más de lo que vendiste. <strong className="text-foreground">No es
                pérdida</strong>: lo que no se ha vendido sigue en la bodega (míralo en Inventario).
              </p>
            )}

            {datos.meses.length > 1 && (
              <Panel>
                <GraficoBarras
                  datos={datos.meses.map((m) => ({ mes: m.mes, vendido: m.vendido }))}
                  series={[{ clave: 'vendido', nombre: 'Vendido', color: SERIE_A }]}
                  titulo="Vendido por mes"
                  formato={formatPrice}
                />
              </Panel>
            )}

            <TablaMeses datos={datos} />

            <div className="grid gap-4 lg:grid-cols-3">
              <PanelPerdidas p={datos.perdidas} />
              <Ranking
                titulo="Los más vendidos"
                filas={datos.top_productos.map((p) => ({ nombre: p.nombre, valor: p.unidades }))}
                formato={unidades}
                vacio="No hay ventas pagadas enlazadas al catálogo en estas fechas."
                color={SERIE_A}
              />
              {/* `ml` en null = ventas viejas sin talla o productos sin ella: fuera
                  del ranking, una barra "sin talla" no compara nada. */}
              <Ranking
                titulo="Unidades por talla"
                filas={datos.por_talla.filter((t) => t.ml != null).map((t) => ({ nombre: `${t.ml} ml`, valor: t.unidades }))}
                formato={unidades}
                vacio="Las ventas de estas fechas no guardaban la talla."
                color={SERIE_A}
              />
            </div>
          </>
        )}
      </div>
    </ReporteShell>
  );
}
