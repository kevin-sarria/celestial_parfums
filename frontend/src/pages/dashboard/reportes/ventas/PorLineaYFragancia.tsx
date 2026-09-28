import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice } from '../../helpers';
import { Ganancia, Th, celda, fija, margen } from './TablaMeses';
import type { CifrasDeGrupo, ReporteVentasRango } from './tipos';

/**
 * Lo vendido por LÍNEA (contratipo, 1.1, original, accesorios) y por
 * FRAGANCIA, con su ganancia y su margen (2026-09-28).
 *
 * La pregunta que responde: ¿qué línea y qué fragancia dejan más plata? La
 * más vendida no es siempre la que más deja — en el respaldo de producción,
 * de agosto al 22 de septiembre, el contratipo dejó 52 % de margen y el 1.1
 * un 34 %.
 */

/** Cuántas fragancias se ven antes de pulsar "Ver todas". */
const TOPE_FRAGANCIAS = 10;

function Tabla({ primera, filas, pie }: {
  primera: string;
  filas: { clave: string | number; nombre: ReactNode; c: CifrasDeGrupo }[];
  pie?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-[13px]">
          <thead>
            <tr className="bg-secondary/60">
              <Th izq>{primera}</Th><Th>Unidades</Th><Th>Vendido</Th><Th>Ganancia</Th><Th>Margen</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ clave, nombre, c }) => (
              <tr key={clave} className="border-t border-border">
                <td className={cn(fija, 'max-w-52 truncate py-2 font-medium')}>{nombre}</td>
                <td className={celda}>{c.unidades}</td>
                <td className={celda}>{formatPrice(c.vendido)}</td>
                <td className={celda}><Ganancia valor={c.ganancia} cobertura={c.cobertura_pct} /></td>
                <td className={celda}>{margen(c.margen_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pie && <div className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground">{pie}</div>}
    </div>
  );
}

const Titulo = ({ children, detalle }: { children: ReactNode; detalle: string }) => (
  <div className="mb-2">
    <h2 className="font-display text-[16px] font-medium text-foreground">{children}</h2>
    <p className="text-[12.5px] text-muted-foreground">{detalle}</p>
  </div>
);

export function PorLineaYFragancia({ datos }: { datos: ReporteVentasRango }) {
  const [todas, setTodas] = useState(false);
  const total = datos.ventas.vendido;
  const fragancias = todas ? datos.por_fragancia : datos.por_fragancia.slice(0, TOPE_FRAGANCIAS);

  if (datos.por_linea.length === 0) return null;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="min-w-0">
        <Titulo detalle="Solo lo pagado por completo. La ganancia, donde hay costo registrado.">Por línea</Titulo>
        <Tabla
          primera="Línea"
          filas={datos.por_linea.map((l) => ({
            clave: l.linea,
            nombre: (
              <span>
                {l.linea}
                {total > 0 && (
                  <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                    {Math.round((l.vendido / total) * 100)} %
                  </span>
                )}
              </span>
            ),
            c: l,
          }))}
          pie={datos.ventas_repartidas > 0
            ? `${datos.ventas_repartidas} ${datos.ventas_repartidas === 1 ? 'venta mezcló' : 'ventas mezclaron'} líneas: se repartió según el precio de catálogo de cada producto.`
            : undefined}
        />
      </section>

      <section className="min-w-0">
        <Titulo detalle="De la que más ganancia deja a la que menos. Las que no tienen costo registrado van al final.">
          Por fragancia
        </Titulo>
        <Tabla
          primera="Fragancia"
          filas={fragancias.map((f) => ({ clave: f.perfume_id, nombre: <span title={f.nombre}>{f.nombre}</span>, c: f }))}
          pie={datos.por_fragancia.length > TOPE_FRAGANCIAS && (
            <Button variant="ghost" size="sm" className="-mx-2 h-7" onClick={() => setTodas((t) => !t)}>
              {todas ? 'Ver solo las 10 primeras' : `Ver las ${datos.por_fragancia.length}`}
            </Button>
          )}
        />
      </section>
    </div>
  );
}
