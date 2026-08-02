import GraficoBarras, { SERIE_A } from '../GraficoBarras';
import { Panel, Ranking, ReporteShell, useReporte } from '../reportes/comun';
import { formatPrice } from '../helpers';
import { StatCard, StatRow } from '../ui';
import type { GuardedFetch } from '../types';

interface ReporteClientes {
  serie: { mes: string; nuevos: number }[];
  total: number;
  con_cuenta: number;
  sin_cuenta: number;
  compradores: number;
  sin_comprar: number;
  con_deuda: number;
  deuda_total: number;
  referidos_total: number;
  referidos_compraron: number;
  top_clientes: { user_id: number; nombre: string; total: number; compras: number }[];
}

/** Quiénes son los clientes, quién compra y quién debe. */
export function ReportesClientesTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const { datos, cargando, error, recargar } = useReporte<ReporteClientes>(guardedFetch, 'clientes');

  return (
    <ReporteShell titulo="Reporte de clientes" cargando={cargando} error={error} onReintentar={recargar}>
      {datos && (
        <>
          <StatRow>
            <StatCard label="Clientes registrados" value={datos.total} />
            <StatCard label="Ya te compraron" value={datos.compradores} />
            {datos.con_deuda > 0 && (
              <StatCard
                label={`Con deuda abierta (${datos.con_deuda})`}
                value={formatPrice(datos.deuda_total)}
              />
            )}
          </StatRow>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel>
              <GraficoBarras
                datos={datos.serie}
                series={[{ clave: 'nuevos', nombre: 'Clientes nuevos', color: SERIE_A }]}
                titulo="Clientes nuevos por mes (últimos 12)"
                formato={(n) => `${n}`}
              />
            </Panel>

            <Panel>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Cómo está la lista
              </h3>
              <dl className="flex flex-col gap-2 text-[13px]">
                <Dato termino="Entran solos a la web" valor={datos.con_cuenta} />
                {/* Ficha creada por el admin: existe en el sistema pero todavía
                    no tiene acceso a la página. */}
                <Dato termino="Fichas creadas por ti (sin cuenta)" valor={datos.sin_cuenta} />
                <Dato termino="Registrados que aún no compran" valor={datos.sin_comprar} />
                <Dato termino="Llegaron por una invitación" valor={datos.referidos_total} />
                {datos.referidos_total > 0 && (
                  <Dato termino="…y de esos ya compraron" valor={datos.referidos_compraron} />
                )}
              </dl>
              {datos.sin_comprar > 0 && (
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Esos {datos.sin_comprar} ya te dejaron su contacto: es a quien más barato le sale venderle.
                </p>
              )}
            </Panel>
          </div>

          <div className="mt-4">
            <Ranking
              titulo="Tus mejores clientes"
              filas={datos.top_clientes.map((c) => ({
                nombre: c.nombre,
                valor: c.total,
                detalle: `${c.compras} ${c.compras === 1 ? 'compra' : 'compras'}`,
              }))}
              formato={formatPrice}
              vacio="Todavía no hay ventas enlazadas a una persona."
              color={SERIE_A}
            />
          </div>
        </>
      )}
    </ReporteShell>
  );
}

function Dato({ termino, valor }: { termino: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <dt className="text-muted-foreground">{termino}</dt>
      <dd className="shrink-0 font-medium tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}
