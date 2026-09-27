import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { SmartTable } from '../../../components/table/SmartTable';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { terminadoColumns } from '../columns';
import { EncabezadoPagina, FranjaMetricas, Section, StatCard } from '../ui';
import type { FrascoArmado, ResumenInventario } from '../types';

/**
 * Frascos ya armados: producto terminado, listo para entregar.
 *
 * Vivía ENCIMA de la tabla de materiales, en la misma pantalla de Inventario.
 * El dueño lo pidió aparte el 2026-09-27 (*"así me confundo mucho"*): son dos
 * preguntas distintas —"¿con qué material cuento?" y "¿qué tengo listo para
 * vender?"— y apiladas se leían como una sola lista. Mismo criterio con el que
 * se separaron Productos y Accesorios: cada cosa, su pestaña.
 *
 * Lee el mismo resumen que Inventario (`urls.inventario.resumen`): los frascos
 * se calculan de los movimientos en cada consulta, no se guardan aparte.
 */
export function FrascosArmadosTab() {
  const [filas, setFilas] = useState<FrascoArmado[]>([]);
  const [unidades, setUnidades] = useState(0);
  const [valor, setValor] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setCargando(true);
    try {
      const res = await http.get<{ data: ResumenInventario }>(urls.inventario.resumen);
      if (!res.ok) throw new Error(res.error);
      const t = res.cuerpo?.data.terminado ?? { filas: [], unidades: 0, valor: 0 };
      setFilas(t.filas); setUnidades(t.unidades); setValor(t.valor);
      setError('');
    } catch {
      setError('No se pudieron cargar los frascos armados. Revisa tu conexión y reintenta.');
    } finally { setCargando(false); }
  };
  useEffect(() => { load(); }, []);

  if (cargando) return <Section><PerfumeSpinner /></Section>;

  const enNegativo = filas.filter((f) => f.cantidad < 0).length;

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Frascos armados" count={filas.length} />

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={load}>Reintentar</Button>
        </p>
      )}

      <FranjaMetricas>
        <StatCard label="Frascos listos" value={String(unidades)}
          nota={`${filas.length} ${filas.length === 1 ? 'perfume y talla' : 'combinaciones de perfume y talla'}`} />
        <StatCard label="Valor" value={formatPrice(valor)}
          nota="Al costo congelado el día que se armaron" />
        {enNegativo > 0 && (
          <StatCard label="En negativo" value={String(enNegativo)}
            nota="Se vendió más de lo armado: revisa esas filas" />
        )}
      </FranjaMetricas>

      <Section>
        <p className="text-[12.5px] text-muted-foreground">
          Producto terminado, listo para entregar. Su material ya se descontó el día que lo
          armaste, así que al venderlo <strong className="text-foreground">no se vuelve a
          descontar</strong>. Para armar más, envasar o cargar los que ya tenías, usa{' '}
          <Link to="/dashboard/inventario" className="font-medium text-primary hover:underline">
            Inventario
          </Link>.
        </p>
        <SmartTable
          columns={terminadoColumns}
          rows={filas}
          rowKey={f => `${f.perfume_id}-${f.presentacion_id}`}
          paginadoLocal
          tarjetaMovil
          emptyText="Todavía no has armado frascos por adelantado."
        />
      </Section>
    </div>
  );
}
