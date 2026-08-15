import { useRef, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '../../../components/Modal';
import BuscadorSelect from '../../../components/BuscadorSelect';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import type { ColumnDef } from '../../../components/table/tableTypes';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field } from '../ui';
import type { GuardedFetch, Lookup } from '../types';

/** Lo que devuelven las mutaciones para poder avisar si fallaron. */
export type ResultadoLookup = { ok: boolean; error?: string; id?: number };

/**
 * Configuración para las listas cuyo borrado arrastra otros datos.
 * Hoy solo categorías: sus perfumes NO se pueden quedar sin categoría, porque
 * el precio sale de la lista categoría × talla y caerían al de respaldo.
 */
export interface MudanzaLookup {
  /**
   * Cómo se llaman los datos que arrastra, en las dos formas. Se piden ambas y
   * no se deduce quitando la "s": en español eso falla más de lo que acierta.
   */
  etiqueta: { uno: string; varios: string };
  /** Frase de advertencia que se muestra antes de confirmar. */
  advertencia: string;
  onMoverYEliminar: (id: number, destinoId: number) => Promise<ResultadoLookup>;
}

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
  /** Si está y el elemento tiene `usos`, borrar exige mudar sus datos antes. */
  mudanza?: MudanzaLookup;
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
  onAdd, onDelete, onEdit, mudanza, importEntity, guardedFetch, onImported,
}: LookupTabProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  // Mudanza: a dónde pasan los datos del elemento que se va a borrar
  const [mudar, setMudar] = useState<Lookup | null>(null);
  const [destino, setDestino] = useState<number | ''>('');
  const [nuevoDestino, setNuevoDestino] = useState<string | null>(null);

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
    // En uso: no se borra a secas, primero hay que decir a dónde pasan sus datos
    if (mudanza && (item.usos ?? 0) > 0) {
      setMudar(item); setDestino(''); setNuevoDestino(null);
      return;
    }
    const r = await onDelete(item.id);
    if (!r.ok) toast.error(r.error ?? 'No se pudo eliminar', { id: 'lookup' });
  };

  /** Crea el destino sobre la marcha y lo deja elegido, sin salir del modal. */
  const crearDestino = async () => {
    const nombre = (nuevoDestino ?? '').trim();
    if (!nombre) { toast.error('Escribe un nombre', { id: 'lookup' }); return; }
    if (items.some(i => normaliza(i.nombre) === normaliza(nombre))) {
      toast.error(`"${nombre}" ya está en la lista`, { id: 'lookup' }); return;
    }
    setGuardando(true);
    try {
      const r = await onAdd(nombre);
      if (!r.ok || !r.id) { toast.error(r.error ?? 'No se pudo crear', { id: 'lookup' }); return; }
      setDestino(r.id); setNuevoDestino(null);
      toast.success(`"${nombre}" creada, ya quedó elegida como destino`);
    } finally { setGuardando(false); }
  };

  const moverYEliminar = async () => {
    if (!mudar || !mudanza || typeof destino !== 'number') return;
    setGuardando(true);
    try {
      const r = await mudanza.onMoverYEliminar(mudar.id, destino);
      if (!r.ok) { toast.error(r.error ?? 'No se pudo eliminar', { id: 'lookup' }); return; }
      const nombreDestino = items.find(i => i.id === destino)?.nombre;
      const que = (mudar.usos ?? 0) === 1 ? mudanza.etiqueta.uno : mudanza.etiqueta.varios;
      toast.success(nombreDestino
        ? `"${mudar.nombre}" eliminada. Sus ${que} pasaron a ${nombreDestino}`
        : `"${mudar.nombre}" eliminada y sus ${que} fueron movidos`);
      setMudar(null);
    } finally { setGuardando(false); }
  };

  const columnas: ColumnDef<Lookup>[] = [
    {
      key: 'nombre', header: 'Nombre', type: 'string',
      getValue: i => i.nombre,
      render: i => (
        <span>
          {i.nombre}
          {i.nota && (
            <span className="block text-[12px] font-normal text-muted-foreground">{i.nota}</span>
          )}
        </span>
      ),
      className: 'font-medium text-foreground',
      movil: 'titulo',
      noTruncate: true,
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
                <ExportButton entity={importEntity} />
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

      {/* Mudanza obligatoria: borrar sin decir a dónde van sus datos los
          dejaría huérfanos y, en categorías, les cambiaría el precio. */}
      {mudar && mudanza && (() => {
        const n = mudar.usos ?? 0;
        const cuantos = `${n} ${n === 1 ? mudanza.etiqueta.uno : mudanza.etiqueta.varios}`;
        return (
        <Modal
          open
          onClose={() => setMudar(null)}
          title={`Eliminar "${mudar.nombre}"`}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setMudar(null)}>Cancelar</Button>
              <Button
                type="button"
                disabled={guardando || typeof destino !== 'number'}
                onClick={moverYEliminar}
              >
                {guardando ? 'Moviendo…' : 'Mover y eliminar'}
              </Button>
            </div>
          }
        >
          {/* Redactado sin género ni artículo: la frase sirve igual para
              "categoría" que para cualquier lista que use esto mañana. */}
          <p className="text-[13px] text-foreground">
            Hay <strong>{cuantos}</strong> aquí dentro. Antes de eliminar, elige a dónde{' '}
            {n === 1 ? 'pasa' : 'pasan'}.
          </p>

          <Field label={`Mover ${cuantos} a *`}>
            <BuscadorSelect
              value={String(destino)}
              placeholder="Elegir destino…"
              opciones={[
                { id: 'nuevo', nombre: `+ Crear ${nuevo.toLowerCase()}` },
                ...items.filter(i => i.id !== mudar.id).map(i => ({ id: i.id, nombre: i.nombre })),
              ]}
              onSelect={id => {
                if (String(id) === 'nuevo') { setNuevoDestino(''); setDestino(''); }
                else { setDestino(Number(id)); setNuevoDestino(null); }
              }}
            />
          </Field>

          {nuevoDestino !== null && (
            <div className="space-y-2 rounded-lg border border-primary/25 bg-brand-soft/40 p-3">
              <Field label="Nombre *">
                <Input
                  autoFocus
                  maxLength={100}
                  value={nuevoDestino}
                  onChange={e => setNuevoDestino(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearDestino(); } }}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={guardando} onClick={crearDestino}>
                  {guardando ? 'Creando…' : 'Crear y elegir'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNuevoDestino(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
            {mudanza.advertencia}
          </p>
        </Modal>
        );
      })()}

      {importEntity && guardedFetch && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          entity={importEntity}
          onImported={onImported ?? (() => {})}
        />
      )}
    </>
  );
}
