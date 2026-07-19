import { useState } from 'react';
import { Trash2, Upload, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import type { GuardedFetch, Lookup } from '../types';

interface LookupTabProps {
  title: string;
  items: Lookup[];
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  /** Renombra un elemento existente sin perder sus relaciones. */
  onEdit?: (id: number, name: string) => Promise<void>;
  /** Entidad del backend para importar/exportar (aromas, ocasiones, categorias, presentaciones). */
  importEntity?: string;
  guardedFetch?: GuardedFetch;
  onImported?: () => void;
}

export function LookupTab({ title, items, placeholder, onAdd, onDelete, onEdit, importEntity, guardedFetch, onImported }: LookupTabProps) {
  const [value, setValue] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!value.trim()) return;
    await onAdd(value);
    setValue('');
  };

  const handleSaveEdit = async () => {
    if (!editing || !onEdit || !editing.value.trim()) return;
    setSaving(true);
    try {
      await onEdit(editing.id, editing.value.trim());
      setEditing(null);
    } finally { setSaving(false); }
  };

  return (
    <Section className="mx-auto w-full max-w-3xl">
      <Toolbar>
        <SectionTitle count={items.length}>{title}</SectionTitle>
        {importEntity && guardedFetch && (
          <ToolbarActions>
            <ExportButton entity={importEntity} guardedFetch={guardedFetch} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
          </ToolbarActions>
        )}
      </Toolbar>

      <div className="flex max-w-sm gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd}>Agregar</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">#</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Nombre</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id} className="text-[13px]">
                <TableCell className="text-muted-foreground">{item.id}</TableCell>
                <TableCell className="font-medium">
                  {editing?.id === item.id ? (
                    <Input
                      autoFocus
                      value={editing.value}
                      maxLength={100}
                      className="h-8 max-w-64"
                      onChange={e => setEditing({ id: item.id, value: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    item.nombre
                  )}
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="flex items-center justify-end gap-1">
                    {editing?.id === item.id ? (
                      <>
                        <Button
                          variant="ghost" size="icon" className="size-8 text-primary"
                          onClick={handleSaveEdit}
                          disabled={saving || !editing.value.trim()}
                          title="Guardar"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="size-8 text-muted-foreground"
                          onClick={() => setEditing(null)}
                          title="Cancelar"
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {onEdit && (
                          <Button
                            variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditing({ id: item.id, value: item.nombre })}
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(item.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {importEntity && guardedFetch && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          entity={importEntity}
          guardedFetch={guardedFetch}
          onImported={onImported ?? (() => {})}
        />
      )}
    </Section>
  );
}
