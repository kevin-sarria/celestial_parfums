import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccionesPerfume } from './perfumes/AccionesPerfume';
import ExportButton from '../../../components/ExportButton';
import ImportModal from '../../../components/ImportModal';
import DescargarCatalogoButton from '../../../components/DescargarCatalogoButton';
import { SmartTable } from '../../../components/table/SmartTable';
import { columnasDeLinea } from '../columns';
import { FichaPerfumeModal } from './perfumes/FichaPerfumeModal';
import { useFichaPerfume } from './perfumes/useFichaPerfume';
import { PrimerosPasosProductos } from './productos/PrimerosPasosProductos';
import { Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';
import { NoSePudoCargar } from '../../../components/NoSePudoCargar';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { ponerPerfume, refrescar, useClasificaciones, useLineaCatalogo } from '../catalogo/estadoCatalogo';
import { useAuthContext } from '../../../application/context/useAuthContext';
import { TIPO_DE_LINEA, SUSTANTIVO_LINEA, valoresDeTipo, type LineaCatalogo } from './perfumes/tipoDeProducto';

/**
 * UNA PESTAÑA POR LÍNEA (2026-10-04, proyecto 3 del rediseño).
 *
 * Antes Perfumes y Productos eran dos archivos casi idénticos. Con cuatro
 * líneas serían cuatro copias de lo mismo; aquí una sola recibe la línea y de
 * ella saca el título, las columnas, el sustantivo de la ficha, el Excel y el
 * punto de partida del alta (`valoresDeTipo`).
 */
interface LineaTabProps {
  linea: LineaCatalogo;
}

const TITULOS: Record<LineaCatalogo, string> = {
  contratipo: 'Contratipos',
  uno_uno: '1.1',
  original: 'Originales',
  producto: 'Productos y accesorios',
};

const VACIOS: Record<LineaCatalogo, string> = {
  contratipo: 'Todavía no tienes contratipos. Aquí van las fragancias que fabricas contra pedido.',
  uno_uno: 'Todavía no armas ningún 1.1. Aquí van los que preparas por adelantado con su envase premium.',
  original: 'Aquí van tus originales y sus decants. Lo normal es que nazcan al comprar la botella en Compras a proveedores.',
  producto: 'Todavía no tienes productos. Aquí van los splash que compras hechos y los accesorios (perfumero, bolsa, tarjeta).',
};

export function LineaTab({ linea }: LineaTabProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [recargarPasos, setRecargarPasos] = useState(0);
  // Los datos viven en el estado central del catálogo: esta pestaña pide solo su página
  const { aromas, ocasiones, categorias, presentaciones } = useClasificaciones();
  const { items, total, page, pageSize, cargando, error, onPageChange, onPageSizeChange, onSearch, onFilter, onClearAll } = useLineaCatalogo(linea);
  // Crear, borrar, publicar…: se marca viejo y se pide solo lo que está en pantalla
  const onMutate = () => { void refrescar.perfumes(); };
  const onMutateConPasos = () => { onMutate(); setRecargarPasos((v) => v + 1); };

  const { isAdmin } = useAuthContext();
  const esProducto = linea === 'producto';
  const ficha = useFichaPerfume({
    aromas, ocasiones, presentaciones,
    onMutate: esProducto ? onMutateConPasos : onMutate,
    // Editar: el servidor devuelve el perfume ya actualizado y se cambia solo esa fila
    onGuardado: esProducto ? (p) => { ponerPerfume(p); setRecargarPasos((v) => v + 1); } : ponerPerfume,
    activa: isAdmin,
    valoresIniciales: valoresDeTipo(TIPO_DE_LINEA[linea]),
    // Cada pestaña abre su puerta ya elegida (decisión 3 del diseño)
    tipoInicial: TIPO_DE_LINEA[linea],
  });

  const sustantivo = SUSTANTIVO_LINEA[linea];
  const esContratipo = linea === 'contratipo';

  return (
    <>
      {esProducto && isAdmin && (
        <PrimerosPasosProductos recargar={recargarPasos} />
      )}

      <Section>
        <Toolbar>
          <SectionTitle count={total}>{TITULOS[linea]}</SectionTitle>
          {isAdmin && (
            <ToolbarActions>
              {esContratipo && <DescargarCatalogoButton />}
              <ExportButton entity="perfumes" linea={linea} archivo={linea} />
              {esContratipo && (
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" /> Importar
                </Button>
              )}
              <Button size="sm" onClick={ficha.abrirNuevo}>+ Nuevo {sustantivo}</Button>
            </ToolbarActions>
          )}
        </Toolbar>

        {linea === 'original' && (
          <p className="mb-3 text-[13px] text-muted-foreground">
            Los originales suelen nacer al comprar la botella en Compras a proveedores. Este botón
            sirve para completar o corregir una ficha ya empezada. Los precios de sus tallas se ponen en{' '}
            <Link to="/dashboard/precios_originales" className="font-medium text-primary underline underline-offset-2">Precios de originales</Link>.
          </p>
        )}

        {error && <NoSePudoCargar que={TITULOS[linea].toLowerCase()} onReintentar={onMutate} />}
        {cargando ? <PerfumeSpinner /> : (
        <SmartTable
          columns={columnasDeLinea(linea)}
          rows={items}
          rowKey={p => p.id}
          onServerSearch={onSearch}
          onServerFilter={onFilter}
          onServerClearAll={onClearAll}
          pagination={{ page, totalRows: total, pageSize, onPageChange, onPageSizeChange }}
          emptyText={VACIOS[linea]}
          renderActions={isAdmin ? p => (
            <AccionesPerfume
              perfume={p}
              onCambiado={esProducto ? onMutateConPasos : onMutate}
              onEditar={() => ficha.abrirEdicion(p)}
              onEliminar={() => ficha.eliminar(p.id)}
            />
          ) : undefined}
        />
        )}
      </Section>

      {esContratipo && (
        <ImportModal open={importOpen} onClose={() => setImportOpen(false)} entity="perfumes" onImported={onMutate} />
      )}

      <FichaPerfumeModal
        ficha={ficha}
        aromas={aromas}
        ocasiones={ocasiones}
        categorias={categorias}
        presentaciones={presentaciones}
        sustantivo={sustantivo}
      />
    </>
  );
}
