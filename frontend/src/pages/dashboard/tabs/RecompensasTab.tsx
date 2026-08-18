import { useEffect, useState } from 'react';
import { Gift, Settings2, Sparkles, Star, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DialogFooter } from '@/components/ui/dialog';
import Modal from '../../../components/Modal';
import { SmartTable } from '../../../components/table/SmartTable';
import type { ColumnDef, FiltersState } from '../../../components/table/tableTypes';
import RecompensaConfigModal from './RecompensaConfigModal';
import EntregasModeracion from './EntregasModeracion';
import { toast } from 'sonner';
import { DEFAULT_PAGE_SIZE, formatPrice } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field } from '../ui';
import type { RecompensaConfig, RecompensaClienteRow } from '../types';

const cellName = 'whitespace-nowrap font-medium text-foreground';

/** Estrellas + N/M de una tarjeta. */
function Progreso({ row }: { row: RecompensaClienteRow }) {
  const t = row.tarjeta;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: Math.min(t.objetivo, 10) }).map((_, i) => (
          <Star key={i} className="size-3.5" fill={i < t.sellos ? 'currentColor' : 'none'}
            style={{ color: i < t.sellos ? '#c99b3f' : 'var(--muted-foreground)' }} />
        ))}
      </div>
      <span className="text-[12.5px] font-medium tabular-nums text-foreground">{t.sellos}/{t.objetivo}</span>
      {t.premio_listo && <Badge className="rounded-full bg-primary text-primary-foreground">¡Listo!</Badge>}
    </div>
  );
}

/**
 * Admin de la tarjeta de recompensas: configuración global (en un modal con
 * previsualización) + tabla de clientes con su progreso, entrega de premios y
 * regla especial por cliente.
 */
export function RecompensasTab() {
  const [config, setConfig] = useState<RecompensaConfig | null>(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgError, setCfgError] = useState('');

  const [clientes, setClientes] = useState<RecompensaClienteRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filtros, setFiltros] = useState<FiltersState>({});

  const [ovCliente, setOvCliente] = useState<RecompensaClienteRow | null>(null);
  const [ovForm, setOvForm] = useState({ objetivo: '', premio: '', min: '' });
  const [ovSaving, setOvSaving] = useState(false);

  const loadConfig = async () => {
    const res = await http.get<{ data?: RecompensaConfig }>(urls.recompensas.config);
    if (res.ok) setConfig(res.cuerpo?.data ?? null);
  };

  const loadClientes = async (p = page, s = pageSize, term = search, filtrosActuales = filtros) => {
    const res = await http.get<{ data?: RecompensaClienteRow[]; total?: number }>(
      urls.recompensas.clientes,
      {
        params: {
          page: p, limit: s,
          ...(term ? { search: term } : {}),
          ...(Object.keys(filtrosActuales).length ? { filtros: JSON.stringify(filtrosActuales) } : {}),
        },
      },
    );
    if (!res.ok) { toast.error(res.error, { id: 'recompensas' }); return; }
    setClientes(res.cuerpo?.data ?? []);
    setTotal(res.cuerpo?.total ?? 0);
    setPage(p);
    setFiltros(filtrosActuales);
  };

  useEffect(() => { loadConfig(); loadClientes(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = async () => {
    if (!config) return;
    setCfgSaving(true); setCfgError('');
    try {
      const res = await http.patch<{ data: RecompensaConfig }>(urls.recompensas.config, {
        activo: config.activo,
        sellos_objetivo: Number(config.sellos_objetivo) || 1,
        premio: config.premio.trim(),
        min_compra: Number(config.min_compra) || 0,
        color_fondo: config.color_fondo,
        color_lineas: config.color_lineas,
        color_texto: config.color_texto,
      });
      if (!res.ok || !res.cuerpo) { setCfgError(res.error || 'No se pudo guardar'); return; }
      setConfig(res.cuerpo.data); setCfgOpen(false); loadClientes();
    } finally { setCfgSaving(false); }
  };

  const entregarPremio = async (c: RecompensaClienteRow) => {
    if (!window.confirm(`¿Entregaste el premio a ${c.nombre} ${c.apellido}? La tarjeta se reinicia.`)) return;
    const res = await http.post(urls.recompensas.entregar(c.id));
    if (!res.ok) { toast.error(res.error, { id: 'recompensas' }); return; }
    loadClientes();
  };

  const abrirOverride = (c: RecompensaClienteRow) => {
    setOvCliente(c);
    const t = c.tarjeta;
    setOvForm({
      objetivo: t.tiene_override ? String(t.objetivo) : '',
      premio: t.tiene_override ? t.premio : '',
      min: t.tiene_override && t.min_compra > 0 ? String(t.min_compra) : '',
    });
  };

  const guardarOverride = async (limpiar = false) => {
    if (!ovCliente) return;
    setOvSaving(true);
    try {
      const body = limpiar
        ? { objetivo_override: null, premio_override: null, min_compra_override: null }
        : {
            objetivo_override: ovForm.objetivo.trim() ? Number(ovForm.objetivo) : null,
            premio_override: ovForm.premio.trim() || null,
            min_compra_override: ovForm.min.trim() ? Number(ovForm.min) : null,
          };
      const res = await http.patch(urls.recompensas.override(ovCliente.id), body);
      if (!res.ok) { toast.error(res.error, { id: 'recompensas' }); return; }
      setOvCliente(null); loadClientes();
    } finally { setOvSaving(false); }
  };

  const columns: ColumnDef<RecompensaClienteRow>[] = [
    {
      key: 'cliente', header: 'Cliente', type: 'string',
      getValue: c => `${c.nombre} ${c.apellido}`,
      render: c => (
        <span>
          <span className="flex items-center gap-1.5">
            {c.nombre} {c.apellido}
            {c.tarjeta.tiene_override && <Badge variant="secondary" className="rounded-full text-[10.5px] text-primary">Regla propia</Badge>}
          </span>
          <span className="block text-[11px] text-muted-foreground">{c.correo ?? c.telefono ?? 'sin contacto'}</span>
        </span>
      ),
      className: cellName,
    },
    /**
     * Sin filtro: "sellos" y "premios entregados" se recalculan del historial
     * de ventas de cada cliente (ver el encabezado de `recompensa.repository.ts`),
     * así que no hay columna que el servidor pueda mirar sin traer y calcular a
     * TODOS los clientes primero. Ofrecer el embudo aquí volvería a filtrar
     * solo la página cargada — el mismo bug que se arregló en el resto de tablas.
     */
    { key: 'progreso', header: 'Progreso', type: 'number', getValue: c => c.tarjeta.sellos, render: c => <Progreso row={c} />, noTruncate: true, filterable: false },
    {
      key: 'entregados', header: 'Premios dados', type: 'number',
      getValue: c => c.tarjeta.premios_entregados,
      render: c => c.tarjeta.premios_entregados > 0
        ? <span className="tabular-nums text-foreground">{c.tarjeta.premios_entregados}</span>
        : <span className="text-muted-foreground">—</span>,
      noTruncate: true, filterable: false,
    },
  ];

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={total}>Progreso de clientes</SectionTitle>
          <ToolbarActions>
            <Button variant="outline" size="sm" onClick={() => setCfgOpen(true)} disabled={!config}>
              <Settings2 className="size-4" /> Configurar tarjeta
            </Button>
          </ToolbarActions>
        </Toolbar>

        {config && !config.activo && (
          <p className="mb-3 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
            El programa está desactivado: los clientes no ven su tarjeta. Actívalo en "Configurar tarjeta".
          </p>
        )}

        <SmartTable
          columns={columns}
          rows={clientes}
          rowKey={c => c.id}
          onServerSearch={t => { setSearch(t); loadClientes(1, pageSize, t); }}
          onServerFilter={f => loadClientes(1, pageSize, search, f)}
          onServerClearAll={() => loadClientes(1, pageSize, '', {})}
          pagination={{
            page, totalRows: total, pageSize,
            onPageChange: p => loadClientes(p, pageSize),
            onPageSizeChange: s => { setPageSize(s); loadClientes(1, s); },
          }}
          renderActions={c => (
            <>
              {c.tarjeta.premio_listo && (
                <Button size="sm" className="h-8" onClick={() => entregarPremio(c)}>
                  <Sparkles className="size-4" /> Entregar
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary"
                title="Regla especial para este cliente" onClick={() => abrirOverride(c)}>
                <Wand2 className="size-4" />
              </Button>
            </>
          )}
        />
      </Section>

      <div className="mt-8">
        <EntregasModeracion />
      </div>

      {config && (
        <RecompensaConfigModal
          open={cfgOpen}
          onClose={() => setCfgOpen(false)}
          config={config}
          onChange={setConfig}
          onSave={saveConfig}
          saving={cfgSaving}
          error={cfgError}
        />
      )}

      {/* Modal: regla especial por cliente */}
      <Modal
        open={!!ovCliente}
        onClose={() => setOvCliente(null)}
        title={ovCliente ? `Regla especial · ${ovCliente.nombre}` : 'Regla especial'}
        maxWidth={440}
        footer={
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => guardarOverride(true)} disabled={ovSaving}>
              Quitar regla
            </Button>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOvCliente(null)}>Cancelar</Button>
              <Button type="button" onClick={() => guardarOverride(false)} disabled={ovSaving}>
                {ovSaving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        }
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-primary">
            <Gift className="mt-0.5 size-4 shrink-0" />
            Deja un campo vacío para que ese dato use la configuración global. Solo llena lo que
            quieras cambiarle a ESTE cliente.
          </p>
          <Field label="Sellos para su premio">
            <Input type="number" min="1" max="50" placeholder={`Global: ${config?.sellos_objetivo ?? ''}`}
              value={ovForm.objetivo} onChange={e => setOvForm(f => ({ ...f, objetivo: e.target.value }))} />
          </Field>
          <Field label="Su premio">
            <Input maxLength={200} placeholder={config?.premio ?? ''}
              value={ovForm.premio} onChange={e => setOvForm(f => ({ ...f, premio: e.target.value }))} />
          </Field>
          <Field label="Su compra mínima por sello">
            <Input type="number" min="0" placeholder={`Global: ${config ? formatPrice(config.min_compra) : ''}`}
              value={ovForm.min} onChange={e => setOvForm(f => ({ ...f, min: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
