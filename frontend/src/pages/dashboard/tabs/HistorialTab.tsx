import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SmartTable } from '../../../components/table/SmartTable';
import type { ColumnDef } from '../../../components/table/tableTypes';
import { DEFAULT_PAGE_SIZE } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Section, SectionTitle, Toolbar } from '../ui';

interface Cambio {
  id: number;
  usuario: string;
  modulo: string;
  resumen: string;
  datos: Record<string, unknown> | null;
  created_at: string;
}

/** Fecha y hora de Colombia: es un instante (cuándo se hizo), no un día de calendario. */
const cuando = (iso: string) => new Date(iso).toLocaleString('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

/** Un valor del cambio en una línea legible: listas y objetos resumidos. */
const legible = (v: unknown): string => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (Array.isArray(v)) return v.length > 3 ? `${v.length} elementos` : v.map(legible).join(', ');
  if (typeof v === 'object') return `${Object.keys(v).length} campos`;
  const texto = String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return texto.length > 60 ? `${texto.slice(0, 60)}…` : texto;
};

function DatosDelCambio({ datos }: { datos: Cambio['datos'] }) {
  const pares = Object.entries(datos ?? {});
  if (!pares.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="block text-[12px] leading-snug text-muted-foreground">
      {pares.slice(0, 6).map(([k, v]) => (
        <span key={k} className="mr-2 inline-block">
          <span className="text-foreground/70">{k.replace(/_/g, ' ')}:</span> {legible(v)}
        </span>
      ))}
      {pares.length > 6 && <span>… y {pares.length - 6} más</span>}
    </span>
  );
}

const columns: ColumnDef<Cambio>[] = [
  {
    key: 'created_at', header: 'Cuándo', type: 'string', getValue: c => c.created_at,
    render: c => <span className="whitespace-nowrap tabular-nums">{cuando(c.created_at)}</span>,
    filterable: false, sortable: false, noTruncate: true, movil: 'meta',
  },
  { key: 'usuario', header: 'Quién', type: 'string', getValue: c => c.usuario, filterable: false, sortable: false, movil: 'estado' },
  {
    key: 'resumen', header: 'Qué hizo', type: 'string', getValue: c => c.resumen,
    filterable: false, sortable: false, noTruncate: true, movil: 'titulo',
  },
  {
    key: 'datos', header: 'Con qué datos', type: 'string', getValue: () => '',
    render: c => <DatosDelCambio datos={c.datos} />, filterable: false, sortable: false, noTruncate: true,
  },
];

/**
 * HISTORIAL DE CAMBIOS (2026-10-03, tercera tanda de la revisión): quién
 * cambió qué y cuándo en el panel. Se llena solo (ver
 * `backend/src/middleware/registroCambios.ts`); aquí solo se lee.
 *
 * Hace falta antes de tener empleados —el día que algo no cuadre, hay a quién
 * preguntarle— y sirve desde ya para responder "¿cuándo cambié este precio?".
 */
export function HistorialTab() {
  const [filas, setFilas] = useState<Cambio[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const cargar = async (p = page, s = pageSize, term = search) => {
    try {
      const res = await http.get<{ data?: Cambio[]; total?: number }>(urls.historial, {
        params: { page: p, limit: s, ...(term ? { search: term } : {}) },
      });
      if (!res.ok) { toast.error(res.error, { id: 'historial' }); return; }
      setFilas(res.cuerpo?.data ?? []);
      setTotal(res.cuerpo?.total ?? 0);
      setPage(p);
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'historial' }); }
  };

  useEffect(() => { cargar(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={total}>Historial de cambios</SectionTitle>
      </Toolbar>
      <p className="-mt-1 mb-3 text-[12.5px] text-muted-foreground">
        Cada cambio que se hace en el panel queda aquí: quién, cuándo y con qué datos. Empezó a anotarse el 3 de octubre de 2026.
      </p>
      <SmartTable
        columns={columns}
        rows={filas}
        rowKey={c => c.id}
        tarjetaMovil
        onServerSearch={t => { setSearch(t); cargar(1, pageSize, t); }}
        onServerClearAll={() => { setSearch(''); cargar(1, pageSize, ''); }}
        pagination={{
          page, totalRows: total, pageSize,
          onPageChange: p => cargar(p),
          onPageSizeChange: s => { setPageSize(s); cargar(1, s); },
        }}
      />
    </Section>
  );
}
