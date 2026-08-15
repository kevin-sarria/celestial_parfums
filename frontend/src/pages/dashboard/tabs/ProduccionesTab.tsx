import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { formatPrice } from '../helpers';
import { produccionesColumns } from '../columns';
import { EncabezadoPagina, FranjaMetricas, Section, StatCard } from '../ui';
import type { GuardedFetch, Produccion } from '../types';


/** Corte del mes en curso en UTC: las fechas @db.Date se leen a medianoche UTC. */
const inicioDeMes = () => {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 1)).toISOString().slice(0, 10);
};

/**
 * Historial de lotes armados.
 *
 * Vive aparte de Inventario a propósito: esa pantalla responde "qué tengo" y
 * esta "qué armé". Tenerlas juntas dejaba dos tablas apiladas y la segunda
 * ensuciaba la principal — decisión del dueño el 2026-08-04.
 */
export function ProduccionesTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [producciones, setProducciones] = useState<Produccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await http.get<{ data: Produccion[] }>(urls.inventario.producciones);
      if (!res.ok) throw new Error(res.error);
      setProducciones(res.cuerpo?.data ?? []);
      setError('');
    } catch {
      setError('No se pudieron cargar las producciones. Revisa tu conexión y reintenta.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const borrar = async (p: Produccion) => {
    // Borrar un lote deshace las DOS cosas que hizo al registrarse: devuelve el
    // material y quita los frascos armados. Decirlo importa: si esos frascos ya
    // se vendieron, el conteo queda en negativo y hay que ajustarlo a mano.
    const aviso = p.perfume_nombre
      ? `¿Borrar el lote de ${p.cantidad} × ${p.perfume_nombre} ${p.volumen_nombre}?\n\n`
        + 'El material vuelve al inventario y se quitan esos frascos de "Frascos ya armados". '
        + 'Si alguno ya se vendió, el conteo quedará en negativo.'
      : `¿Borrar el lote de ${p.cantidad} × ${p.volumen_nombre}? Los insumos vuelven al inventario.`;
    if (!window.confirm(aviso)) return;
    const res = await http.borrar(urls.inventario.produccion(p.id));
    if (!res.ok) { toast.error(res.error, { id: 'prod-del' }); return; }
    toast.success(p.perfume_nombre
      ? 'Lote borrado: el material volvió al inventario y esos frascos ya no están armados'
      : 'Lote borrado: los insumos volvieron al inventario');
    load();
  };

  if (loading) return <Section><PerfumeSpinner /></Section>;

  const desde = inicioDeMes();
  const delMes = producciones.filter(p => p.fecha.slice(0, 10) >= desde);
  const unidadesMes = delMes.reduce((s, p) => s + p.cantidad, 0);
  const costoMes = delMes.reduce((s, p) => s + p.costo_total, 0);

  return (
    <div className="space-y-4">
      <EncabezadoPagina titulo="Producciones" count={producciones.length} />

      {error && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {error}
          <Button size="sm" variant="outline" className="h-7" onClick={load}>Reintentar</Button>
        </p>
      )}

      <FranjaMetricas>
        <StatCard label="Armado este mes" value={String(unidadesMes)}
          nota={`En ${delMes.length} ${delMes.length === 1 ? 'lote' : 'lotes'}`} />
        <StatCard label="Costo de lo armado" value={formatPrice(costoMes)}
          nota="Lo que valieron los insumos que se consumieron" />
        <StatCard label="Lotes registrados" value={String(producciones.length)}
          nota="Todo el historial" />
      </FranjaMetricas>

      <Section>
        <p className="text-[12.5px] text-muted-foreground">
          Cada lote descontó sus insumos al registrarse y dejó sus frascos listos en{' '}
          <Link to="/dashboard/inventario" className="text-primary hover:underline">Inventario</Link>
          , en <strong className="text-foreground">Frascos ya armados</strong> — al venderlos no se
          vuelve a descontar material. Si borras un lote,
          <strong className="text-foreground"> el material vuelve y los frascos se quitan</strong>.
          Para registrar uno nuevo, usa <strong className="text-foreground">Registrar uso → Armé
          perfumes</strong> en Inventario.
        </p>

        <SmartTable
          columns={produccionesColumns}
          rows={producciones}
          rowKey={p => p.id}
          numerada
          paginadoLocal
          tarjetaMovil
          emptyText="Todavía no has registrado lotes."
          renderActions={p => (
            <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => borrar(p)}>
              <Trash2 className="size-4" />
            </Button>
          )}
          accionesMovil={p => (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => borrar(p)}>
              <Trash2 className="size-4" /> Borrar lote
            </Button>
          )}
          acciones={<ExportButton entity="producciones" guardedFetch={guardedFetch} />}
        />
      </Section>
    </div>
  );
}
