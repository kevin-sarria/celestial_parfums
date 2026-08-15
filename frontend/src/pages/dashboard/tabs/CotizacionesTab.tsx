import { useEffect, useState } from 'react';
import { Download, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import CotizacionForm from '../cotizacion/CotizacionForm';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { DEFAULT_PAGE_SIZE, fmtInstante, formatPrice } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import { descargarCotizacionPdf } from '../../../utils/cotizacionPdf';
import type { Cotizacion, CotizacionConfig } from '../../../domain/entities/cotizacion.types';

/**
 * Cotizaciones mayoristas: listado y acceso al formulario. La vista cambia
 * entre lista y formulario (no modal) porque el formulario necesita ancho real.
 */
export function CotizacionesTab() {
  const [vista, setVista] = useState<'lista' | 'form'>('lista');
  const [editando, setEditando] = useState<Cotizacion | null>(null);
  const [rows, setRows] = useState<Cotizacion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<CotizacionConfig | null>(null);

  const [errorCarga, setErrorCarga] = useState('');
  // finally: un fallo de red o un 429 no debe dejar la vista cargando eterno.
  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await http.get<{ data?: Cotizacion[]; total?: number }>(urls.cotizaciones.lista, {
        params: { page: p, limit: DEFAULT_PAGE_SIZE },
      });
      if (!res.ok) { setErrorCarga(res.error); return; }
      setRows(res.cuerpo?.data ?? []);
      setTotal(res.cuerpo?.total ?? 0);
      setPage(p);
      setErrorCarga('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // Sin configuración solo se pierde el PDF, no la lista: por eso va suelta.
    http.get<{ data?: CotizacionConfig }>(urls.costeo.config)
      .then((r) => setConfig(r.cuerpo?.data ?? null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Relee la cotización completa: la lista trae lo justo para pintar el renglón. */
  const traerCompleta = async (c: Cotizacion): Promise<Cotizacion | null> => {
    const res = await http.get<{ data?: Cotizacion }>(urls.cotizaciones.cotizacion(c.id));
    if (!res.ok) { toast.error(res.error, { id: 'cotizaciones' }); return null; }
    return res.cuerpo?.data ?? c;
  };

  const abrirNueva = () => { setEditando(null); setVista('form'); };
  const abrirEditar = async (c: Cotizacion) => {
    const completa = await traerCompleta(c);
    if (!completa) return;
    setEditando(completa);
    setVista('form');
  };

  const eliminar = async (c: Cotizacion) => {
    if (!window.confirm(`¿Eliminar la cotización ${c.numero}?`)) return;
    const res = await http.borrar(urls.cotizaciones.cotizacion(c.id));
    if (!res.ok) { toast.error(res.error, { id: 'cotizaciones' }); return; }
    load();
    toast.success('Cotización eliminada');
  };

  const descargar = async (c: Cotizacion) => {
    if (!config) return;
    const completa = await traerCompleta(c);
    if (completa) descargarCotizacionPdf(completa, config);
  };

  if (vista === 'form') {
    return (
      <CotizacionForm
        cotizacion={editando}
        onVolver={() => { setVista('lista'); load(); }}
        onGuardada={() => load()}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={total}>Cotizaciones mayoristas</SectionTitle>
        <ToolbarActions>
          <Button size="sm" onClick={abrirNueva}><Plus className="size-4" /> Nueva cotización</Button>
        </ToolbarActions>
      </Toolbar>

      <p className="mb-5 flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Cotizaciones para clientes que quieren <strong>revender</strong> tus perfumes. El sistema
          calcula tu ganancia con los costos que registraste, pero el PDF que recibe el cliente
          <strong> solo muestra precios</strong>, nunca tus costos internos.
        </span>
      </p>

      {errorCarga && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-destructive">
          {errorCarga}
          <Button size="sm" variant="outline" className="h-7" onClick={() => load()}>Reintentar</Button>
        </p>
      )}

      {loading ? <PerfumeSpinner /> : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          {errorCarga ? 'No se pudo cargar la lista.' : 'Aún no has creado cotizaciones. Empieza con "Nueva cotización".'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <div className="min-w-40 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-foreground">
                  {c.numero} · {c.cliente_empresa || c.cliente_nombre}
                  <Badge variant="outline" className={`rounded-full text-[10.5px] ${
                    c.estado === 'enviada'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-amber-300 bg-amber-50 text-amber-700'
                  }`}>
                    {c.estado === 'enviada' ? 'Enviada' : 'Borrador'}
                  </Badge>
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {c.tipo === 'general'
                    ? `Lista de precios · ${c.lista_precios?.length ?? 0} ${(c.lista_precios?.length ?? 0) === 1 ? 'tamaño' : 'tamaños'}`
                    : `${c.items.length} ${c.items.length === 1 ? 'producto' : 'productos'}`}
                  {' · '}{fmtInstante(c.fecha)}
                </p>
              </div>
              {/* Una lista de precios no tiene total: aún no hay pedido */}
              <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-primary">
                {c.tipo === 'general' ? '—' : formatPrice(c.total)}
              </span>
              <Button size="icon" variant="ghost" className="size-8" title="Descargar PDF" onClick={() => descargar(c)}>
                <Download className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-8" title="Editar" onClick={() => abrirEditar(c)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive"
                title="Eliminar" onClick={() => eliminar(c)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-[13px]">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Anterior</Button>
          <span className="text-muted-foreground">Página {page} de {totalPaginas}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPaginas} onClick={() => load(page + 1)}>Siguiente</Button>
        </div>
      )}
    </Section>
  );
}
