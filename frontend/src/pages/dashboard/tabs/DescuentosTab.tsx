import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { finalPrice } from '@/lib/format';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import { formatPrice, API, API_COMBOS } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import type { GuardedFetch } from '../types';

interface DescuentosTabProps {
  perfumes: Perfume[];
  combos: Combo[];
  guardedFetch: GuardedFetch;
  onMutate: () => void;
}

const headCell = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

interface DiscountTableProps {
  title: string;
  rows: { id: number; nombre: string; precio: number; descuento: number }[];
  editPrefix: string;
  edits: Record<string, string>;
  onEdit: (key: string, value: string) => void;
  onSave: (id: number) => void;
}

/** Tabla editable de descuentos, compartida por perfumes y combos. */
function DiscountTable({ title, rows, editPrefix, edits, onEdit, onSave }: DiscountTableProps) {
  const withDiscount = rows.filter(r => r.descuento > 0).length;

  return (
    <div className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {title}
        <Badge variant="secondary" className="rounded-full font-normal">
          {withDiscount} con descuento
        </Badge>
      </h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-130">
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className={headCell}>{title}</TableHead>
              <TableHead className={headCell}>Precio</TableHead>
              <TableHead className={headCell}>Descuento %</TableHead>
              <TableHead className={headCell}>Precio final</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => {
              const key = `${editPrefix}-${r.id}`;
              const val = edits[key] ?? String(r.descuento);
              const final_ = finalPrice(r.precio, Number(val));
              return (
                <TableRow key={r.id} className="text-[13px]">
                  <TableCell className="font-medium text-foreground">{r.nombre}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatPrice(r.precio)}</TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" max="100" value={val}
                      className="h-8 w-20"
                      onChange={e => onEdit(key, e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                    {Number(val) > 0 ? formatPrice(final_) : '—'}
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <Button size="sm" className="h-7 px-3 text-xs" onClick={() => onSave(r.id)}>
                      Guardar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function DescuentosTab({ perfumes, combos, guardedFetch, onMutate }: DescuentosTabProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);

  const setEdit = (key: string, value: string) => setEdits(prev => ({ ...prev, [key]: value }));

  const savePerfume = async (id: number) => {
    const val = Number(edits[`p-${id}`] ?? 0);
    await guardedFetch(`${API}/${id}/descuento`, { method: 'PATCH', body: JSON.stringify({ descuento: val }) });
    onMutate();
  };

  const saveCombo = async (id: number) => {
    const val = Number(edits[`c-${id}`] ?? 0);
    await guardedFetch(`${API_COMBOS}/${id}/descuento`, { method: 'PATCH', body: JSON.stringify({ descuento: val }) });
    onMutate();
  };

  return (
    <Section>
      <Toolbar>
        <SectionTitle>Descuentos</SectionTitle>
        <ToolbarActions>
          <ExportButton entity="descuentos" guardedFetch={guardedFetch} />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Importar
          </Button>
        </ToolbarActions>
      </Toolbar>
      <p className="text-[13px] text-muted-foreground">
        Edita el % de descuento de cada perfume o combo. El precio con descuento se calcula automaticamente.
      </p>

      <DiscountTable
        title="Perfumes"
        rows={perfumes}
        editPrefix="p"
        edits={edits}
        onEdit={setEdit}
        onSave={savePerfume}
      />

      <DiscountTable
        title="Combos"
        rows={combos}
        editPrefix="c"
        edits={edits}
        onEdit={setEdit}
        onSave={saveCombo}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="descuentos"
        guardedFetch={guardedFetch}
        onImported={onMutate}
      />
    </Section>
  );
}
