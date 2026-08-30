import { Link } from 'react-router-dom';
import { Droplets, FlaskConical, PackageCheck, PackagePlus, Plus, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExportMenu from '../../../../components/ExportMenu';
import MenuAcciones from '../../../../components/MenuAcciones';

/**
 * LA BARRA DE ACCIONES DE INVENTARIO, agrupada por la PREGUNTA que responde.
 *
 * Había crecido a seis botones del mismo peso —uno por cada función nueva— y
 * encontrar lo que se hace a diario costaba lo mismo que encontrar lo de una vez
 * al mes. Ahora: lo que se configura de vez en cuando en un menú, lo que consume
 * material en otro, y **una sola acción destacada**, que es la que de verdad se
 * usa (61 compras registradas contra 0 producciones).
 *
 * Los nombres van en el idioma del dueño: "Registrar uso", nunca "Movimientos"
 * — esa palabra es del sistema, no del negocio.
 *
 * Salió de `InventarioTab.tsx` cuando ese archivo pasó de 500 líneas al entrar
 * la maceración: es una barra de botones que no sabe nada del inventario, solo
 * qué hacer cuando se pulsa cada uno.
 */

interface Props {
  onImportar: () => void;
  onMaterialNuevo: () => void;
  onAsignarEsencias: () => void;
  onFrascosYaArmados: () => void;
  onMacerar: () => void;
  onEnvasar: () => void;
  onArmarDirecto: () => void;
  onSalida: () => void;
}

export function AccionesInventario({
  onImportar, onMaterialNuevo, onAsignarEsencias, onFrascosYaArmados,
  onMacerar, onEnvasar, onArmarDirecto, onSalida,
}: Props) {
  return (
    <>
      {/* Excel es mantenimiento: cabe detrás de un clic para no competir con las
          tres acciones reales del día. */}
      <ExportMenu
        onImportar={onImportar}
        importarLabel="Subir hoja de conteo"
        descargas={[
          { entity: 'inventario', label: 'Hoja de conteo', nota: 'Para contar y volver a subirla' },
          { entity: 'insumos', label: 'Lista de materiales', nota: 'Qué usas y cuánto cuesta' },
          { entity: 'movimientos', label: 'Historial de entradas y salidas', nota: 'Solo se descarga' },
        ]}
      />

      <MenuAcciones
        label="Materiales" icon={Plus} titulo="Dar de alta y clasificar"
        acciones={[
          {
            label: 'Material nuevo', icon: Plus,
            nota: 'Una esencia, un frasco, un accesorio',
            onSelect: onMaterialNuevo,
          },
          {
            // Vive aquí y no solo en Primeros pasos: esa caja desaparece al
            // completarse, y sin esto la asignación quedaría inalcanzable para
            // el próximo perfume nuevo.
            label: 'Asignar esencias', icon: Wand2,
            nota: 'Enlazar varias fragancias de una vez',
            onSelect: onAsignarEsencias,
          },
          {
            // Va en "dar de alta" y no en "registrar uso" a propósito: aquí no
            // sale nada de la bodega, entra algo que ya existía.
            label: 'Frascos ya armados', icon: FlaskConical,
            nota: 'Los que armaste antes, sin descontar material',
            onSelect: onFrascosYaArmados,
          },
        ]}
      />

      {/**
        * PRODUCIR SON DOS MOMENTOS, y por eso aquí hay tres opciones donde antes
        * había una. Van en el orden en que ocurren: primero se macera, semanas
        * después se envasa. "Armé directo" es el camino de siempre, para cuando
        * se prepara y se envasa el mismo día.
        */}
      <MenuAcciones
        label="Registrar uso" icon={Droplets} titulo="Material que salió"
        acciones={[
          {
            label: 'Puse a macerar', icon: FlaskConical,
            nota: 'Gasta esencia y diluyente. NO gasta envases',
            onSelect: onMacerar,
          },
          {
            label: 'Envasé frascos', icon: PackageCheck,
            nota: 'Gasta envases y saca ml de un granel',
            onSelect: onEnvasar,
          },
          {
            label: 'Armé directo (sin macerar)', icon: FlaskConical,
            nota: 'Todo el mismo día: descuenta la receta entera',
            onSelect: onArmarDirecto,
          },
          {
            label: 'Muestra, regalo o daño', icon: Droplets,
            nota: 'Salió sin venta: mostrario o pérdida',
            onSelect: onSalida,
          },
        ]}
      />

      <Button size="sm" asChild>
        <Link to="/dashboard/pagos?nueva=1">
          <PackagePlus className="size-4" /> Registrar llegada
        </Link>
      </Button>
    </>
  );
}
