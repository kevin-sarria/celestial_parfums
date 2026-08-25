import { hoy } from '../../../utils/fechas';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
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
import { ProduccionModal, type PerfumeLite } from './inventario/ProduccionModal';
import type { FrascoArmado, InventarioInsumo, Produccion, ResumenInventario } from '../types';
import type { CatalogoItem, CatalogoRespuesta } from '../types';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';


/**
 * El día 1 del mes en curso. Sale de `hoy()` —la fecha LOCAL— y no de
 * `getUTCMonth()`: el último día del mes, pasadas las 7 p.m., en UTC ya es el
 * mes siguiente, y esa noche el historial arrancaba un mes adelantado.
 */
const inicioDeMes = () => `${hoy().slice(0, 8)}01`;

/**
 * Historial de lotes armados.
 *
 * Vive aparte de Inventario a propósito: esa pantalla responde "qué tengo" y
 * esta "qué armé". Tenerlas juntas dejaba dos tablas apiladas y la segunda
 * ensuciaba la principal — decisión del dueño el 2026-08-04.
 */
export function ProduccionesTab() {
  const [producciones, setProducciones] = useState<Produccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** El lote que se está corrigiendo; null = nadie. */
  const [editando, setEditando] = useState<Produccion | null>(null);
  // Lo que necesita el modal de corrección: es el MISMO de "Armé perfumes", así
  // que pide los mismos datos.
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [perfumes, setPerfumes] = useState<PerfumeLite[]>([]);
  const [catalogo, setCatalogo] = useState<Insumo[]>([]);
  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [armados, setArmados] = useState<FrascoArmado[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [rp, rf, rc, ri, rpf] = await Promise.all([
        http.get<{ data: Produccion[] }>(urls.inventario.producciones),
        http.get<{ data: FormulaVolumen[] }>(urls.costeo.formulas),
        http.get<{ data: Insumo[] }>(urls.costeo.insumos),
        http.get<{ data: ResumenInventario }>(urls.inventario.resumen),
        http.get<CatalogoRespuesta>(urls.perfumes.todos),
      ]);
      if (!rp.ok) throw new Error(rp.error);
      setProducciones(rp.cuerpo?.data ?? []);
      // Lo demás es para poder CORREGIR un lote. Si falla, la tabla se ve igual
      // y solo se queda sin el lápiz: no tiene sentido tumbar la pantalla.
      setFormulas(rf.cuerpo?.data ?? []);
      setCatalogo(rc.cuerpo?.data ?? []);
      setInsumos(ri.cuerpo?.data?.insumos ?? []);
      setArmados(ri.cuerpo?.data?.terminado.filas ?? []);
      const jp = rpf.cuerpo?.data;
      const lista = Array.isArray(jp) ? jp : (jp?.data ?? []);
      setPerfumes(lista.map((p: CatalogoItem) => ({
        id: p.id, nombre: p.nombre, insumo_esencia_id: p.insumo_esencia_id ?? null,
      })));
      setError('');
    } catch {
      setError('No se pudieron cargar las producciones. Revisa tu conexión y reintenta.');
    } finally { setLoading(false); }
  };

  /** Frascos armados que hay hoy de la ficha de ese lote, para avisar antes de bajar la cantidad. */
  const armadosDe = (p: Produccion) =>
    armados.find((f) => f.perfume === p.perfume_nombre)?.cantidad ?? null;
  useEffect(() => { load(); }, []);

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
            <>
              <Button size="icon" variant="ghost" aria-label="Corregir lote" title="Corregir lote"
                className="size-8 text-muted-foreground hover:text-primary"
                onClick={() => setEditando(p)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Borrar lote"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => borrar(p)}>
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
          accionesMovil={p => (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditando(p)}>
                <Pencil className="size-4" /> Corregir lote
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => borrar(p)}>
                <Trash2 className="size-4" /> Borrar lote
              </Button>
            </>
          )}
          acciones={<ExportButton entity="producciones" />}
        />
      </Section>

      {editando && (
        <ProduccionModal
          lote={editando}
          armadosDeLaFicha={armadosDe(editando)}
          formulas={formulas}
          perfumes={perfumes}
          catalogo={catalogo}
          insumos={insumos}
          onClose={() => setEditando(null)}
          onGuardado={load}
        />
      )}
    </div>
  );
}
