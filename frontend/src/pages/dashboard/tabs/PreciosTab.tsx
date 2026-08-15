import { useEffect, useState } from 'react';
import { Check, Info, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { formatPrice } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import type { Lookup, PrecioLista } from '../types';

interface Props {
  categorias: Lookup[];
  presentaciones: Lookup[];
  onMutate: () => void;
}

const headCell = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

/**
 * Lista de precios del negocio: qué vale cada presentación dentro de cada
 * categoría. Es el precio que heredan TODOS los perfumes de esa categoría, así
 * que cambiar una casilla mueve a todos de una vez (salvo los que tienen precio
 * propio en su ficha, como los de esencia premium).
 */
export function PreciosTab({ categorias, presentaciones, onMutate }: Props) {
  const [precios, setPrecios] = useState<PrecioLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const clave = (catId: number, presId: number) => `${catId}-${presId}`;

  const load = async () => {
    try {
      const res = await http.get<{ data: PrecioLista[] }>(urls.perfumes.precios);
      if (res.ok) setPrecios(res.cuerpo?.data ?? []);
    } catch { setError('No se pudo cargar la lista de precios'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const precioDe = (catId: number, presId: number) =>
    precios.find(p => p.categoria_id === catId && p.presentacion_id === presId)?.precio ?? null;

  /** Guarda al salir de la casilla; vacío = esa combinación deja de tener precio. */
  const guardar = async (catId: number, presId: number) => {
    const k = clave(catId, presId);
    const texto = edits[k];
    if (texto === undefined) return;
    const actual = precioDe(catId, presId);
    const nuevo = texto.trim() === '' ? null : Number(texto);
    if (nuevo !== null && (isNaN(nuevo) || nuevo <= 0)) { setError('El precio debe ser mayor a 0'); return; }
    if (nuevo === actual) { setEdits(e => { const n = { ...e }; delete n[k]; return n; }); return; }

    setGuardando(k); setError('');
    try {
      const res = await http.patch(urls.perfumes.precios, {
        categoria_id: catId, presentacion_id: presId, precio: nuevo,
      });
      if (!res.ok) { setError(res.error); return; }
      setEdits(e => { const n = { ...e }; delete n[k]; return n; });
      await load();
      onMutate();
      setGuardado(k);
      setTimeout(() => setGuardado(g => (g === k ? null : g)), 2000);
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setGuardando(null); }
  };

  if (loading) return <PerfumeSpinner />;

  return (
    <Section>
      <Toolbar>
        <SectionTitle>Lista de precios</SectionTitle>
        <ToolbarActions>
          <ExportButton entity="precios" />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Importar
          </Button>
        </ToolbarActions>
      </Toolbar>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="precios"
        onImported={() => { load(); onMutate(); }}
      />

      <p className="mb-4 flex items-start gap-2 rounded-xl border border-primary/25 bg-brand-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Aquí defines cuánto vale cada tamaño en cada categoría. Todos los perfumes de
          esa categoría cobran este precio automáticamente, así que subirlo aquí los sube
          a todos de una vez. Los perfumes con precio propio en su ficha (los de esencia
          premium) no se ven afectados. Deja una casilla vacía si no vendes esa combinación.
        </span>
      </p>

      {error && <p className="mb-3 text-[13px] font-medium text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader className="bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead className={headCell}>Categoría</TableHead>
              {presentaciones.map(pr => (
                <TableHead key={pr.id} className={headCell}>{pr.nombre}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.map(cat => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium text-foreground">{cat.nombre}</TableCell>
                {presentaciones.map(pr => {
                  const k = clave(cat.id, pr.id);
                  const actual = precioDe(cat.id, pr.id);
                  const valor = edits[k] ?? (actual != null ? String(actual) : '');
                  return (
                    <TableCell key={pr.id}>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number" min="0" placeholder="—"
                          className="h-8 max-w-28 text-[13px]"
                          value={valor}
                          disabled={guardando === k}
                          onChange={e => setEdits(prev => ({ ...prev, [k]: e.target.value }))}
                          onBlur={() => guardar(cat.id, pr.id)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                        {guardado === k && <Check className="size-4 shrink-0 text-primary" />}
                      </div>
                      {actual != null && (
                        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                          {formatPrice(actual)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {categorias.length === 0 && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Primero crea al menos una categoría en Clasificaciones → Categorias.
        </p>
      )}
    </Section>
  );
}
