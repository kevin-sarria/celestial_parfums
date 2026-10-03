import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { leerFecha, mesLegible } from '@/utils/calendario';
import { ReporteShell, useReporte } from '../reportes/comun';
import {
  ClientesParaEscribir, EsenciasPorAcabarse, Frascos11SinArmar, ListaPendientes, PanelInicio, UltimasVentas,
} from './inicio/Paneles';
import type { ResumenInicio } from './inicio/tipos';
import { MetaDelMes } from './inicio/MetaDelMes';

/**
 * INICIO: lo primero que ve el dueño al entrar al panel (2026-09-28).
 *
 * Arriba, cuatro números del mes comparados con el mes anterior HASTA EL MISMO
 * DÍA; abajo, lo que hay que atender, las últimas ventas, los 1.1 que se
 * venden y no tienen frascos armados, y las esencias que primero se acaban.
 * Cada bloque lleva a la pantalla con el detalle: Inicio no la repite.
 */

/** "Septiembre" a partir de '2026-09-01…'. */
const nombreMes = (iso: string) => {
  const f = leerFecha(iso.slice(0, 10));
  return f ? mesLegible(f.anio, f.mes).split(' ')[0] : '';
};

/** Cambio contra el mes anterior, en %; null si antes no hubo nada con qué comparar. */
const cambio = (ahora: number, antes: number) => (antes > 0 ? Math.round(((ahora - antes) / antes) * 100) : null);

function Comparacion({ ahora, antes, mesAnterior, formato }: {
  ahora: number; antes: number; mesAnterior: string; formato: (n: number) => string;
}) {
  const pct = cambio(ahora, antes);
  if (pct == null) return <>Sin ventas en {mesAnterior.toLowerCase()} a esta fecha</>;
  const sube = pct >= 0;
  const Flecha = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span className={cn('inline-flex items-center font-semibold', sube ? 'text-emerald-600' : 'text-rose-600')}>
        <Flecha className="size-3.5" />{sube ? '+' : '−'}{Math.abs(pct)} %
      </span>{' '}
      vs. {formato(antes)} en {mesAnterior.toLowerCase()} a esta fecha
    </>
  );
}

function Metrica({ etiqueta, valor, nota }: { etiqueta: string; valor: ReactNode; nota: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{etiqueta}</span>
      <span className="mt-1.5 block font-display text-xl font-medium tabular-nums text-foreground sm:text-2xl">{valor}</span>
      <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{nota}</span>
    </div>
  );
}

export function InicioTab() {
  const { datos, cargando, error, recargar } = useReporte<ResumenInicio>('inicio');
  const d = datos;

  return (
    <ReporteShell titulo="Inicio" cargando={cargando && !d} error={error} onReintentar={recargar}>
      {d && (() => {
        const mes = nombreMes(d.mes.desde);
        const mesAnterior = nombreMes(d.anterior.desde);
        const v = d.mes.ventas;
        const parcial = v.cobertura_pct != null && v.cobertura_pct < 100;
        const unidades = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
        return (
          <div className="space-y-4">
            <p className="-mt-2 text-[13px] text-muted-foreground">
              {mes}, del 1 al {leerFecha(d.mes.hasta.slice(0, 10))?.dia}. Solo cuenta lo pagado por completo.
            </p>

            <MetaDelMes key={d.meta.mes} meta={d.meta} vendido={v.vendido} mes={mes} />

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metrica
                etiqueta={`Vendido en ${mes.toLowerCase()}`}
                valor={formatPrice(v.vendido)}
                nota={<Comparacion ahora={v.vendido} antes={d.anterior.ventas.vendido} mesAnterior={mesAnterior} formato={formatPrice} />}
              />
              <Metrica
                etiqueta="Ganancia"
                valor={v.ganancia == null ? 'Sin datos' : formatPrice(v.ganancia)}
                nota={v.margen_pct == null
                  ? 'Ninguna venta del mes tiene costo registrado'
                  : `Margen ${v.margen_pct.toLocaleString('es-CO')} %${parcial ? ` · parcial, ${v.cobertura_pct} % costeado` : ''}`}
              />
              <Metrica
                etiqueta="Unidades vendidas"
                valor={v.unidades}
                nota={<Comparacion ahora={v.unidades} antes={d.anterior.ventas.unidades} mesAnterior={mesAnterior} formato={unidades} />}
              />
              <Metrica
                etiqueta="Te deben"
                valor={formatPrice(d.cartera.total_en_deuda)}
                nota={d.cartera.vencido > 0
                  ? <span className="font-medium text-rose-600">
                      {formatPrice(d.cartera.vencido)} vencido ({d.cartera.creditos_vencidos} {d.cartera.creditos_vencidos === 1 ? 'crédito' : 'créditos'})
                    </span>
                  : `${d.cartera.clientes_con_deuda} ${d.cartera.clientes_con_deuda === 1 ? 'cliente' : 'clientes'} · nada vencido`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PanelInicio titulo="Qué atender">
                <ListaPendientes pendientes={d.pendientes} />
              </PanelInicio>
              <PanelInicio
                titulo="Clientes para escribirles"
                detalle={`Ya se les debe estar acabando (compran cada ~${d.recompra.punto_medio_dias} días)`}
                enlace={{ a: '/dashboard/recompra', texto: `Recompra (${d.recompra.resumen.le_toca})` }}
              >
                <ClientesParaEscribir clientes={d.recompra.le_toca} />
              </PanelInicio>
              <PanelInicio titulo="Últimas ventas" enlace={{ a: '/dashboard/ventas', texto: 'Ver ventas' }}>
                <UltimasVentas ventas={d.ultimas_ventas} />
              </PanelInicio>
              <PanelInicio
                titulo="Frascos 1.1 por armar"
                detalle={`${d.frascos_11.total_armados} ${d.frascos_11.total_armados === 1 ? 'frasco armado' : 'frascos armados'} de ${d.frascos_11.referencias} ${d.frascos_11.referencias === 1 ? 'referencia' : 'referencias'} en la tienda`}
                enlace={{ a: '/dashboard/armados', texto: 'Frascos armados' }}
              >
                <Frascos11SinArmar filas={d.frascos_11.sin_armar} dias={d.frascos_11.dias} />
              </PanelInicio>
              <PanelInicio
                titulo="Esencias que se acaban primero"
                detalle="Al ritmo de lo gastado en los últimos 90 días"
                enlace={{ a: '/dashboard/reposicion', texto: `Pedido sugerido${d.esencias.total > 0 ? ` (${d.esencias.total})` : ''}` }}
              >
                <EsenciasPorAcabarse filas={d.esencias.filas} />
              </PanelInicio>
            </div>
          </div>
        );
      })()}
    </ReporteShell>
  );
}
