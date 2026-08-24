import { Button } from '@/components/ui/button';
import { AccionesPerfume } from './perfumes/AccionesPerfume';
import ExportButton from '../../../components/ExportButton';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { SmartTable } from '../../../components/table/SmartTable';
import type { FiltersState } from '../../../components/table/tableTypes';
import { productosColumns } from '../columns';
import { FichaPerfumeModal } from './perfumes/FichaPerfumeModal';
import { useFichaPerfume } from './perfumes/useFichaPerfume';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import type { Lookup } from '../types';

interface ProductosTabProps {
  productos: Perfume[];
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

export function ProductosTab({
  productos, page, total, pageSize, aromas, ocasiones, categorias, presentaciones,
  onPageChange, onPageSizeChange, onSearch, onFilter, onClearAll, onMutate,
}: ProductosTabProps) {
  // La ficha (crear/editar/borrar) es la misma que usa Perfumes.
  const ficha = useFichaPerfume({ aromas, ocasiones, categorias, presentaciones, onMutate });

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={productos.length}>Productos</SectionTitle>
          <ToolbarActions>
            <ExportButton entity="perfumes" />
            <Button size="sm" onClick={ficha.abrirNuevo}>+ Nuevo producto</Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={productosColumns}
          rows={productos}
          rowKey={p => p.id}
          onServerSearch={onSearch}
          onServerFilter={onFilter}
          onServerClearAll={onClearAll}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          emptyText="Todavía no tienes productos. Aquí van los 1.1 que armas, los splash que compras hechos y los accesorios."
          renderActions={p => (
            <AccionesPerfume
              perfume={p}
              onCambiado={onMutate}
              onEditar={() => ficha.abrirEdicion(p)}
              onEliminar={() => ficha.eliminar(p.id)}
            />
          )}
        />
      </Section>

      <FichaPerfumeModal ficha={ficha} aromas={aromas} ocasiones={ocasiones}
        categorias={categorias} presentaciones={presentaciones} sustantivo="producto" />
    </>
  );
}
