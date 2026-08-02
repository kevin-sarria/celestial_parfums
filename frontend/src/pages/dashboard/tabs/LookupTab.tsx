import { useRef, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import type { ColumnDef } from '../../../components/table/tableTypes';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field } from '../ui';
import type { GuardedFetch, Lookup } from '../types';

/** Lo que devuelven las mutaciones para poder avisar si fallaron. */
export type ResultadoLookup = { ok: boolean; error?: string };

interface LookupTabProps {
  title: string;
  /** Texto del botón y título del modal de alta. Ej: "Nueva categoría". */
  nuevo: string;
  /** Título del modal de edición. Ej: "Editar categoría". */
  editar: string;
  /** Ayuda bajo el campo. Ej: "Ej: Árabes, Diseñador, Nicho". */
  ejemplo?: string;
  items: Lookup[];
  onAdd: (name: string) => Promise<ResultadoLookup>;
  onDelete: (id: number) => Promise<ResultadoLookup>;
  /** Renombra un elemento existente sin perder sus relaciones. */
  onEdit?: (id: number, name: string) => Promise<ResultadoLookup>;
  /** Entidad del backend para importar/exportar (aromas, ocasiones, categorias, presentaciones). */
  importEntity?: string;
  guardedFetch?: GuardedFetch;
  onImported?: () => void;
}

/** Compara ignorando mayúsculas, tildes y espacios de sobra. */
const normaliza = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Lista simple de clasificación (aromas, ocasiones, categorías, presentaciones).
 * Las cuatro pestañas salen de aquí, así que cualquier arreglo las cubre todas.
 */
export function LookupTab({
  title, nuevo, editar, ejemplo, items,
  onAdd, onDelete, onEdit, importEntity, guardedFetch, onImported,
}: LookupTabProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  const abrirCrear = () => { setValor(''); setModal({ open: true, editId: null }); };
  const abrirEditar = (item: Lookup) => { setValor(item.nombre); setModal({ open: true, editId: item.id }); };
  const cerrar = () => setModal({ open: false, editId: null });

  /**
   * @param seguir true = "Guardar y agregar otro": deja el modal abierto, limpia
   *               el campo y devuelve el cursor para seguir tecleando.
   */
  const guardar = async (seguir: boolean) => {
    const nombre = valor.trim();
    if (!nombre) { toast.error('Escribe un nombre', { id: 'lookup' }); return; }

    // Se avisa antes de gastar una petición; el servidor igual lo valida.
    const repetido = items.some(i => normaliza(i.nombre) === normaliza(nombre) && i.id !== modal.editId);
    if (repetido) { toast.error(`"${nombre}" ya está en la lista`, { id: 'lookup' }); return; }

    setGuardando(true);
    try {
      const r = modal.editId != null && onEdit
        ? await onEdit(modal.editId, nombre)
        : await onAdd(nombre);
      if (!r.ok) { toast.error(r.error ?? 'No se pudo guardar', { id: 'lookup' }); return; }
      toast.success(modal.editId != null ? 'Cambio guardado' : `"${nombre}" agregado`);
      if (seguir) { setValor(''); campoRef.current?.focus(); }
      else cerrar();
    } finally { setGuardando(false); }
  };

  const borrar = async (item: Lookup) => {
    const r = await onDelete(item.id);
    if (!r.ok) toast.error(r.error ?? 'No se pudo eliminar', { id: 'lookup' });
  };

  const columnas: ColumnDef<Lookup>[] = [
    {
      key: 'nombre', header: 'Nombre', type: 'string',
      getValue: i => i.nombre,
      className: 'font-medium text-foreground',
      movil: 'titulo',
    },
  ];

  /** Mismas acciones en dos tamaños: icono en la fila, con texto en la tarjeta. */
  const acciones = (item: Lookup, conTexto: boolean) => (
    <>
      {onEdit && (
        <Button
          variant={conTexto ? 'outline' : 'ghost'}
          size={conTexto ? 'sm' : 'icon'}
          className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
          onClick={() => abrirEditar(item)}
          title="Editar"
        >
          <Pencil className="size-4" />{conTexto && ' Editar'}
        </Button>
      )}
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? 'text-destructive' : 'size-8 text-muted-foreground hover:text-destructive'}
        onClick={() => borrar(item)}
        title="Eliminar"
      >
        <Trash2 className="size-4" />{conTexto && ' Borrar'}
      </Button>
    </>
  );

  return (
    <>
      <Section className="mx-auto w-full max-w-3xl">
        <Toolbar>
          <SectionTitle count={items.length}>{title}</SectionTitle>
          <ToolbarActions>
            {importEntity && guardedFetch && (
              <>
                <ExportButton entity={importEntity} guardedFetch={guardedFetch} />
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" /> Importar
                </Button>
              </>
            )}
            <Button size="sm" onClick={abrirCrear}>+ {nuevo}</Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={columnas}
          rows={items}
          rowKey={i => i.id}
          numerada
          paginadoLocal
          tarjetaMovil
          emptyText="Todavía no hay nada en esta lista"
          renderActions={i => acciones(i, false)}
          accionesMovil={i => acciones(i, true)}
        />
      </Section>

      <Modal
        open={modal.open}
        onClose={cerrar}
        title={modal.editId != null ? editar : nuevo}
        onSubmit={e => { e.preventDefault(); guardar(false); }}
        // `loading` no se pasa: solo lo usa el footer por defecto, y aquí hay uno propio
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cerrar}>Cancelar</Button>
            {modal.editId == null && (
              <Button type="button" variant="outline" disabled={guardando} onClick={() => guardar(true)}>
                Guardar y agregar otro
              </Button>
            )}
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <Field label="Nombre *">
          <Input
            ref={campoRef}
            autoFocus
            required
            maxLength={100}
            value={valor}
            onChange={e => setValor(e.target.value)}
          />
          {ejemplo && <p className="mt-1 text-[12px] text-muted-foreground">{ejemplo}</p>}
        </Field>
      </Modal>

      {importEntity && guardedFetch && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          entity={importEntity}
          guardedFetch={guardedFetch}
          onImported={onImported ?? (() => {})}
        />
      )}
    </>
  );
}
