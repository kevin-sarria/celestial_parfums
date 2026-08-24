import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImportModal from '../../../components/ImportModal';
import { AccionesPerfume } from './perfumes/AccionesPerfume';
import ExportButton from '../../../components/ExportButton';
import DescargarCatalogoButton from '../../../components/DescargarCatalogoButton';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { SmartTable } from '../../../components/table/SmartTable';
import type { FiltersState } from '../../../components/table/tableTypes';
import { perfumesColumns } from '../columns';
import { FichaPerfumeModal } from './perfumes/FichaPerfumeModal';
import { useFichaPerfume } from './perfumes/useFichaPerfume';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import type { Lookup } from '../types';

interface PerfumesTabProps {
  perfumes: Perfume[];
  page: number;
  total: number;
  pageSize: number;
  aromas: Lookup[];
  ocasiones: Lookup[];
  categorias: Lookup[];
  presentaciones: Lookup[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Búsqueda global contra el backend (toda la data, no solo la página cargada). */
  onSearch: (term: string) => void;
  /** Filtros de columna contra el backend (toda la data, no solo la página cargada). */
  onFilter: (filtros: FiltersState) => void;
  /** "Limpiar todo": UNA sola recarga con búsqueda y filtros vacíos a la vez. */
  onClearAll: () => void;
  onMutate: () => void;
}

export function PerfumesTab({
  perfumes, page, total, pageSize, aromas, ocasiones, categorias, presentaciones,
  onPageChange, onPageSizeChange, onSearch, onFilter, onClearAll, onMutate,
}: PerfumesTabProps) {
  const [importOpen, setImportOpen] = useState(false);
  // La ficha (crear/editar/borrar) vive aparte: la pestaña de Productos usa la misma.
  const ficha = useFichaPerfume({ aromas, ocasiones, categorias, presentaciones, onMutate });

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={perfumes.length}>Perfumes</SectionTitle>
          <ToolbarActions>
            <DescargarCatalogoButton />
            <ExportButton entity="perfumes" />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={ficha.abrirNuevo}>+ Nuevo perfume</Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={perfumesColumns}
          rows={perfumes}
          rowKey={p => p.id}
          onServerSearch={onSearch}
          onServerFilter={onFilter}
          onServerClearAll={onClearAll}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          renderActions={p => (
            <>
              {/* Foto y estado son COLUMNAS (ver `columns.tsx`). Aquí solo queda
                  la puerta de acciones de la fila. */}
              <AccionesPerfume
                perfume={p}
                onCambiado={onMutate}
                onEditar={() => ficha.abrirEdicion(p)}
                onEliminar={() => ficha.eliminar(p.id)}
              />
            </>
          )}
        />
      </Section>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="perfumes"
        onImported={onMutate}
      />

      <FichaPerfumeModal
        ficha={ficha}
        aromas={aromas}
        ocasiones={ocasiones}
        categorias={categorias}
        presentaciones={presentaciones}
        sustantivo="perfume"
      />
    </>
  );
}
