import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccionesPerfume } from './perfumes/AccionesPerfume';
import ExportButton from '../../../components/ExportButton';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import { SmartTable } from '../../../components/table/SmartTable';
import type { FiltersState } from '../../../components/table/tableTypes';
import { productosColumns } from '../columns';
import { FichaPerfumeModal } from './perfumes/FichaPerfumeModal';
import { useFichaPerfume } from './perfumes/useFichaPerfume';
import { PrimerosPasosProductos } from './productos/PrimerosPasosProductos';
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
  // Sube cada vez que se guarda o borra algo, para que la caja de primeros
  // pasos se refresque sin recargar la página (el contador solo se entera
  // por props: no escucha `onMutate` por su cuenta).
  const [recargarPasos, setRecargarPasos] = useState(0);
  const onMutateConPasos = () => { onMutate(); setRecargarPasos(v => v + 1); };

  // La ficha (crear/editar/borrar) es la misma que usa Perfumes. Se le da un
  // punto de partida distinto: sin esto, "+ Nuevo producto" heredaba
  // `tipo_producto: 'fabricado'` del formulario en blanco y el producto se
  // iba a la pestaña de Perfumes sin que nada lo avisara.
  const ficha = useFichaPerfume({
    aromas, ocasiones, presentaciones, onMutate: onMutateConPasos,
    valoresIniciales: { tipo_producto: 'comprado' },
  });

  return (
    <div className="space-y-4">
      <PrimerosPasosProductos onNuevoProducto={ficha.abrirNuevo} recargar={recargarPasos} />

      <Section>
        <Toolbar>
          <SectionTitle count={productos.length}>Productos</SectionTitle>
          <ToolbarActions>
            {/* Solo los productos: el Excel de Perfumes se descarga en su pestaña. */}
            <ExportButton entity="perfumes" familia="productos" archivo="productos" />
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
              onCambiado={onMutateConPasos}
              onEditar={() => ficha.abrirEdicion(p)}
              onEliminar={() => ficha.eliminar(p.id)}
            />
          )}
        />
      </Section>

      <FichaPerfumeModal ficha={ficha} aromas={aromas} ocasiones={ocasiones}
        categorias={categorias} presentaciones={presentaciones} sustantivo="producto" />
    </div>
  );
}
