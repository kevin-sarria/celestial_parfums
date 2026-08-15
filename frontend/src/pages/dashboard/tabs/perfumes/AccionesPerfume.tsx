import { useState } from 'react';
import { EyeOff, Eye, MoreHorizontal, PackageX, PackageCheck, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Modal from '../../../../components/Modal';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import type { Perfume } from '../../../../domain/entities/perfume.schema';

/**
 * TODAS las acciones de un perfume, en un solo botón.
 *
 * **La regla del proyecto, que sale de contar**: con 2 acciones por fila
 * (editar y borrar) van los iconos sueltos —así están las otras 9 tablas del
 * dashboard—; con 3 o más, todas al menú. Perfumes tiene cuatro.
 *
 * Se probó dejar el lápiz fuera "porque editar es lo más frecuente" y el dueño
 * lo corrigió con razón: un menú que no contiene la acción principal deja de
 * ser "todo lo que le puedo hacer a esta fila". Y en un catálogo de 212
 * perfumes editar tampoco es una tarea de todos los días.
 *
 * Lo pidió el dueño el 2026-08-14: la fila llevaba un interruptor deslizante,
 * dos badges que parecían botones y dos iconos sueltos. *"Busca la manera de que
 * esas opciones se vean estéticamente mejor, como por ejemplo poner un símbolo
 * de los tres puntos suspensivos y de allí se despliegue un dropdown"*.
 *
 * El **estado se quedó a la vista** (`EstadoPerfume`) y solo se escondieron las
 * ACCIONES: en una tabla de 212 filas hay que poder repasar de un vistazo qué
 * está fuera de la tienda, pero no hace falta tener el interruptor puesto en
 * cada renglón — y así tampoco se dispara con un clic sin querer.
 *
 * Mismo criterio que `MenuAcciones` en Inventario (agrupar por la pregunta que
 * responde cada acción); aquí se escribe aparte porque son acciones DE UNA FILA
 * y dos de ellas necesitan su propia confirmación y su propio estado de carga.
 */

interface Props {
  perfume: Perfume;
  onCambiado: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}

export function AccionesPerfume({ perfume, onCambiado, onEditar, onEliminar }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const sacando = perfume.publicado; // lo que va a pasar si confirma

  /**
   * Sacar o devolver a la tienda. Sigue pidiendo confirmación —decisión del
   * dueño, sostenida el 2026-08-14— porque toca la tienda de cara al público y
   * nada en la pantalla lo grita. Al cancelar queda exactamente como estaba.
   */
  const aplicarPublicado = async () => {
    setGuardando(true);
    try {
      const res = await http.patch<{ message?: string }>(
        urls.perfumes.publicado(perfume.id), { publicado: !perfume.publicado },
      );
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.cuerpo?.message ?? 'Listo');
      setConfirmando(false);
      onCambiado();
    } catch {
      toast.error('No se pudo conectar con el servidor');
    } finally { setGuardando(false); }
  };

  /** Agotado NO saca de la tienda: el perfume se sigue viendo, marcado. */
  const alternarAgotado = async () => {
    try {
      const res = await http.patch(
        urls.perfumes.agotado(perfume.id), { agotado: !perfume.agotado_manual },
      );
      // Si el servidor rechaza, la fila se quedaría igual y nadie sabría por qué.
      if (!res.ok) { toast.error(res.error, { id: 'stock' }); return; }
      onCambiado();
    } catch {
      toast.error('No se pudo conectar con el servidor', { id: 'stock' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground"
            title={`Acciones de ${perfume.nombre}`} aria-label={`Acciones de ${perfume.nombre}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="truncate">{perfume.nombre}</DropdownMenuLabel>

          {/* Editar va PRIMERO y va aquí dentro: un menú que no contiene la
              acción principal deja de ser "todo lo que le puedo hacer a esta
              fila" y pasa a ser "algunas cosas", que es lo peor de los dos
              mundos. Lo señaló el dueño. */}
          <DropdownMenuItem onSelect={onEditar}>
            <Pencil className="size-4" /> Editar
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setConfirmando(true)}>
            {perfume.publicado ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            <span className="flex flex-col">
              {perfume.publicado ? 'Sacar de la tienda' : 'Devolver a la tienda'}
              <span className="text-[11px] text-muted-foreground">
                {perfume.publicado ? 'Desaparece del catálogo' : 'Vuelve a verse en el catálogo'}
              </span>
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={alternarAgotado}>
            {perfume.agotado_manual ? <PackageCheck className="size-4" /> : <PackageX className="size-4" />}
            <span className="flex flex-col">
              {perfume.agotado_manual ? 'Marcar disponible' : 'Marcar agotado'}
              <span className="text-[11px] text-muted-foreground">
                {perfume.agotado_manual
                  ? 'Vuelve a poderse comprar'
                  : 'Se sigue viendo; te piden aviso'}
              </span>
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={onEliminar}>
            <Trash2 className="size-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title={sacando ? 'Sacar de la tienda' : 'Devolver a la tienda'}
        onSubmit={(e) => { e.preventDefault(); aplicarPublicado(); }}
        submitLabel={guardando ? 'Un momento…' : sacando ? 'Sí, sacarlo' : 'Sí, devolverlo'}
        loading={guardando}
        maxWidth={460}
      >
        <p className="text-[13.5px] leading-relaxed text-foreground">
          <strong>{perfume.nombre}</strong>{' '}
          {sacando
            ? 'va a desaparecer de tu tienda: no saldrá en el catálogo, ni en la búsqueda, ni en los destacados, y su página dejará de abrirse.'
            : 'vuelve a aparecer en tu tienda: sale otra vez en el catálogo, en la búsqueda y en su página.'}
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {sacando
            ? 'No se borra nada: sus datos, sus fotos y su historial de ventas quedan intactos, y puedes devolverlo cuando quieras. Si lo que pasa es que se te acabó pero lo sigues vendiendo, usa "Marcar agotado" en vez de esto: así el cliente lo ve y puede pedir que le avises cuando vuelva.'
            : 'Revisa antes que tenga su foto, su precio y su esencia asignada: desde que lo devuelvas, cualquiera puede comprarlo.'}
        </p>
      </Modal>
    </>
  );
}
