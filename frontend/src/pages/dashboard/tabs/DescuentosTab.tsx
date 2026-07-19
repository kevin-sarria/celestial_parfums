import { useEffect, useMemo, useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { finalPrice } from '@/lib/format';
import { formatPrice, API, API_COMBOS } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field } from '../ui';
import type { GuardedFetch, Lookup } from '../types';

interface DescuentosTabProps {
  guardedFetch: GuardedFetch;
  onMutate: () => void;
}

type TipoProd = 'p' | 'c';

/** Producto (perfume o combo) con lo necesario para administrar su descuento. */
interface Row {
  tipo: TipoProd;
  id: number;
  nombre: string;
  precio: number;
  /** % propio del producto (sin contar el heredado de la categoría). */
  descuento: number;
  categoria_id: number | null;
  categoria: string | null;
}

const headCell = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

const rowKey = (r: { tipo: TipoProd; id: number }) => `${r.tipo}-${r.id}`;

const tipoLabel = (r: Row) =>
  `${r.tipo === 'c' ? 'Combo' : 'Perfume'}${r.categoria ? ` — ${r.categoria}` : ''}`;

export function DescuentosTab({ guardedFetch, onMutate }: DescuentosTabProps) {
  // El tab carga el catálogo COMPLETO por su cuenta: la lista paginada del
  // dashboard solo trae una página y dejaba fuera productos del selector.
  const [rows, setRows] = useState<Row[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);

  // Modal de "Agregar descuento"
  const [addOpen, setAddOpen] = useState(false);
  const [modo, setModo] = useState<'individual' | 'categoria'>('individual');
  const [tipoSel, setTipoSel] = useState<'' | TipoProd>('');
  const [catInd, setCatInd] = useState('');   // categoría del modo individual
  const [prodSel, setProdSel] = useState(''); // producto elegido (clave tipo-id)
  const [indPct, setIndPct] = useState('');   // % del modo individual
  const [catSel, setCatSel] = useState('');   // categoría del modo masivo
  const [catPct, setCatPct] = useState('');
  const [applying, setApplying] = useState(false);

  const load = async () => {
    const [pfRes, coRes, catRes] = await Promise.all([
      fetch(`${API}/`), fetch(`${API_COMBOS}/`), fetch(`${API}/categorias`),
    ]);
    const [pf, co, cat] = await Promise.all([pfRes.json(), coRes.json(), catRes.json()]);
    interface ApiPerfume extends Omit<Row, 'tipo'> { descuento_propio?: number }
    const perfumes = ((pf.data?.data ?? []) as ApiPerfume[]).map(r => ({
      ...r,
      tipo: 'p' as const,
      // La API expone el % efectivo en `descuento`; aquí administramos el propio
      descuento: r.descuento_propio ?? r.descuento,
    }));
    const combos = ((co.data ?? []) as Omit<Row, 'tipo'>[]).map(r => ({ ...r, tipo: 'c' as const }));
    setRows([...perfumes, ...combos]);
    setCategorias((cat.data ?? []) as Lookup[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => { await load(); onMutate(); };

  const catsConDescuento = categorias.filter(c => (c.descuento ?? 0) > 0);
  const visible = rows.filter(r => r.descuento > 0);
  const totalConDescuento = catsConDescuento.length + visible.length;

  const perfumesDe = (categoriaId: number) =>
    rows.filter(r => r.tipo === 'p' && r.categoria_id === categoriaId).length;

  const setEdit = (key: string, value: string) => setEdits(prev => ({ ...prev, [key]: value }));

  const clearEdit = (key: string) =>
    setEdits(prev => {
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });

  const save = async (r: Row, override?: number) => {
    const key = rowKey(r);
    const val = override ?? Number(edits[key] ?? r.descuento);
    const base = r.tipo === 'c' ? API_COMBOS : API;
    await guardedFetch(`${base}/${r.id}/descuento`, { method: 'PATCH', body: JSON.stringify({ descuento: val }) });
    clearEdit(key);
    await refresh();
  };

  const saveCategoria = async (c: Lookup, override?: number) => {
    const key = `cat-${c.id}`;
    const val = override ?? Number(edits[key] ?? c.descuento ?? 0);
    await guardedFetch(`${API}/descuento/por-categoria`, {
      method: 'PATCH',
      body: JSON.stringify({ categoria_id: c.id, descuento: val }),
    });
    clearEdit(key);
    await refresh();
  };

  // ── Modal ──────────────────────────────────────────────────────────────────

  const abrirModal = () => {
    setAddOpen(true);
    setModo('individual');
    setTipoSel('');
    setCatInd('');
    setProdSel('');
    setIndPct('');
    setCatSel('');
    setCatPct('');
  };
  const cerrarModal = () => setAddOpen(false);

  // Productos aún sin descuento propio del tipo elegido, filtrados por categoría
  const disponibles = useMemo(
    () => rows.filter(r => r.tipo === tipoSel && r.descuento === 0),
    [rows, tipoSel],
  );
  const haySinCategoria = useMemo(() => disponibles.some(r => r.categoria_id == null), [disponibles]);
  const candidatos = useMemo(() => {
    if (!catInd) return [];
    if (catInd === 'todas') return disponibles;
    if (catInd === 'sin') return disponibles.filter(r => r.categoria_id == null);
    return disponibles.filter(r => r.categoria_id === Number(catInd));
  }, [disponibles, catInd]);

  const agregar = async () => {
    const elegido = rows.find(r => rowKey(r) === prodSel);
    if (!elegido) return;
    setApplying(true);
    try {
      await save(elegido, Number(indPct));
      cerrarModal();
    } finally {
      setApplying(false);
    }
  };

  const aplicarCategoria = async () => {
    setApplying(true);
    try {
      const res = await guardedFetch(`${API}/descuento/por-categoria`, {
        method: 'PATCH',
        body: JSON.stringify({ categoria_id: Number(catSel), descuento: Number(catPct) }),
      });
      if (res.ok) {
        cerrarModal();
        await refresh();
      }
    } finally {
      setApplying(false);
    }
  };

  const perfumesEnCategoria = catSel ? perfumesDe(Number(catSel)) : 0;

  const footerModal =
    modo === 'categoria' ? (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={cerrarModal}>Cancelar</Button>
        <Button
          type="button"
          disabled={!catSel || !(Number(catPct) >= 0 && catPct !== '') || applying}
          onClick={aplicarCategoria}
        >
          {applying ? 'Aplicando…' : 'Guardar descuento de categoría'}
        </Button>
      </div>
    ) : (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={cerrarModal}>Cancelar</Button>
        <Button type="button" disabled={!prodSel || !(Number(indPct) > 0) || applying} onClick={agregar}>
          {applying ? 'Guardando…' : 'Agregar'}
        </Button>
      </div>
    );

  return (
    <Section>
      <Toolbar>
        <SectionTitle>
          Descuentos
          <Badge variant="secondary" className="rounded-full font-normal">
            {totalConDescuento} activos
          </Badge>
        </SectionTitle>
        <ToolbarActions>
          <Button size="sm" onClick={abrirModal}>
            <Plus className="size-4" /> Agregar descuento
          </Button>
          <ExportButton entity="descuentos" guardedFetch={guardedFetch} />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Importar
          </Button>
        </ToolbarActions>
      </Toolbar>
      <p className="text-[13px] text-muted-foreground">
        Un descuento por categoría es un solo registro: todos sus perfumes lo heredan
        automáticamente (aplica el mayor entre el % propio y el de la categoría).
      </p>

      {loading ? (
        <div className="flex justify-center py-10"><PerfumeSpinner /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table className="min-w-150">
            <TableHeader className="bg-secondary/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className={headCell}>Tipo</TableHead>
                <TableHead className={headCell}>Producto</TableHead>
                <TableHead className={headCell}>Precio</TableHead>
                <TableHead className={headCell}>Descuento %</TableHead>
                <TableHead className={headCell}>Precio final</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {catsConDescuento.length === 0 && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-[13px] text-muted-foreground">
                    Sin descuentos activos. Usa “Agregar descuento” para elegir un producto o una categoría.
                  </TableCell>
                </TableRow>
              )}
              {catsConDescuento.map(c => {
                const key = `cat-${c.id}`;
                const val = edits[key] ?? String(c.descuento ?? 0);
                return (
                  <TableRow key={key} className="bg-secondary/30 text-[13px]">
                    <TableCell className="whitespace-nowrap font-medium text-primary">
                      Categoría — {c.nombre}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      Todos sus perfumes ({perfumesDe(c.id)})
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Input
                        type="number" min="0" max="100" value={val} placeholder="%"
                        className="h-8 w-20"
                        onChange={e => setEdit(key, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => saveCategoria(c)}>
                          Guardar
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          aria-label="Quitar descuento de la categoría"
                          title="Quitar descuento de la categoría"
                          onClick={() => saveCategoria(c, 0)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.map(r => {
                const key = rowKey(r);
                const val = edits[key] ?? String(r.descuento);
                const final_ = finalPrice(r.precio, Number(val));
                return (
                  <TableRow key={key} className="text-[13px]">
                    <TableCell className="whitespace-nowrap text-muted-foreground">{tipoLabel(r)}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.nombre}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatPrice(r.precio)}</TableCell>
                    <TableCell>
                      <Input
                        type="number" min="0" max="100" value={val} placeholder="%"
                        className="h-8 w-20"
                        onChange={e => setEdit(key, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                      {Number(val) > 0 ? formatPrice(final_) : '—'}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(r)}>
                          Guardar
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          aria-label="Quitar descuento"
                          title="Quitar descuento"
                          onClick={() => save(r, 0)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal open={addOpen} onClose={cerrarModal} title="Agregar descuento" footer={footerModal}>
        <div className="flex gap-2">
          <Button
            type="button" size="sm"
            variant={modo === 'individual' ? 'default' : 'outline'}
            onClick={() => setModo('individual')}
          >
            Producto individual
          </Button>
          <Button
            type="button" size="sm"
            variant={modo === 'categoria' ? 'default' : 'outline'}
            onClick={() => setModo('categoria')}
          >
            Por categoría
          </Button>
        </div>

        {modo === 'individual' && (
          <div className="space-y-3">
            <Field label="Tipo de producto">
              <NativeSelect
                value={tipoSel}
                onChange={e => { setTipoSel(e.target.value as '' | TipoProd); setCatInd(''); setProdSel(''); }}
              >
                <option value="">— Elige el tipo —</option>
                <option value="p">Perfume</option>
                <option value="c">Combo</option>
              </NativeSelect>
            </Field>
            {tipoSel && (
              <Field label="Categoría">
                <NativeSelect
                  value={catInd}
                  onChange={e => { setCatInd(e.target.value); setProdSel(''); }}
                >
                  <option value="">— Elige una categoría —</option>
                  <option value="todas">Todas las categorías</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                  {haySinCategoria && <option value="sin">Sin categoría</option>}
                </NativeSelect>
              </Field>
            )}
            {tipoSel && catInd && (
              <Field label={tipoSel === 'c' ? 'Combo' : 'Perfume'}>
                <NativeSelect value={prodSel} onChange={e => setProdSel(e.target.value)}>
                  <option value="">
                    {candidatos.length === 0
                      ? 'No hay productos sin descuento en esta categoría'
                      : `— Elige un ${tipoSel === 'c' ? 'combo' : 'perfume'} (${candidatos.length}) —`}
                  </option>
                  {candidatos.map(c => (
                    <option key={rowKey(c)} value={rowKey(c)}>
                      {c.nombre} · {formatPrice(c.precio)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {prodSel && (
              <Field label="Descuento %">
                <Input
                  type="number" min="1" max="100" placeholder="%"
                  value={indPct}
                  className="w-24"
                  onChange={e => setIndPct(e.target.value)}
                />
              </Field>
            )}
            {prodSel && Number(indPct) > 0 && (() => {
              const elegido = rows.find(r => rowKey(r) === prodSel);
              return elegido ? (
                <p className="text-xs text-muted-foreground">
                  Precio final: <span className="font-semibold text-foreground">
                    {formatPrice(finalPrice(elegido.precio, Number(indPct)))}
                  </span> (antes {formatPrice(elegido.precio)})
                </p>
              ) : null;
            })()}
          </div>
        )}

        {modo === 'categoria' && (
          <div className="space-y-3">
            <Field label="Categoría">
              <NativeSelect value={catSel} onChange={e => setCatSel(e.target.value)}>
                <option value="">— Elige una categoría —</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{(c.descuento ?? 0) > 0 ? ` (hoy ${c.descuento}%)` : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Descuento %">
              <Input
                type="number" min="0" max="100" placeholder="%"
                value={catPct}
                className="w-24"
                onChange={e => setCatPct(e.target.value)}
              />
            </Field>
            {catSel && (
              <p className="text-xs text-muted-foreground">
                Se guarda un solo registro en la categoría y sus {perfumesEnCategoria} perfumes
                lo heredan de fondo (aplica el mayor entre el % propio de cada perfume y este).
                Usa 0% para quitarlo.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="descuentos"
        guardedFetch={guardedFetch}
        onImported={refresh}
      />
    </Section>
  );
}
