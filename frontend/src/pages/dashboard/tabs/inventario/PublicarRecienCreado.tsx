import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import type { ArmadoCreado } from './AltaProductoArmado';

interface Props {
  producto: ArmadoCreado;
  /** Se publicó o se descartó: la línea desaparece. */
  onListo: () => void;
}

/**
 * "Ya lo creé, ¿lo enciendo?" — sin cambiar de pantalla.
 *
 * Vive AQUÍ y no dentro del alta porque "Crear y seguir" cierra el formulario y
 * devuelve al lote: si el botón viviera allí, se iría con él y publicar
 * obligaría a irse a Productos, que es justo el viaje que el dueño no hace.
 *
 * Publicar sin foto **avisa, no bloquea** (decisión suya, 2026-08-25): en la
 * tienda se verá una tarjeta vacía, pero el criterio es del dueño. Un producto
 * recién creado nunca tiene foto, así que el aviso sale siempre la primera vez.
 */
export function PublicarRecienCreado({ producto, onListo }: Props) {
  const [avisado, setAvisado] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const publicar = async () => {
    if (!avisado) { setAvisado(true); return; }
    setPublicando(true);
    try {
      const res = await http.patch(urls.perfumes.publicado(producto.id), { publicado: true });
      if (!res.ok) { toast.error(res.error, { id: 'publicar-armado' }); return; }
      toast.success(`"${producto.nombre}" ya se ve en la tienda`);
      onListo();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'publicar-armado' }); }
    finally { setPublicando(false); }
  };

  return (
    <div className="mt-2 rounded-lg border border-primary/25 bg-brand-soft/25 px-3 py-2.5">
      <p className="text-[12.5px] text-foreground">
        <strong>{producto.nombre}</strong> quedó creado, fuera de la tienda.
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={publicar} disabled={publicando}>
          {avisado ? 'Publicar igual' : 'Publicar en la tienda'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onListo} disabled={publicando}>
          Después
        </Button>
      </div>

      {avisado && (
        <p className="mt-1.5 text-[12px] font-medium text-amber-700">
          Todavía no tiene foto: en la tienda se verá una tarjeta sin imagen. Puedes publicarlo
          igual y ponerle la foto después, desde Productos.
        </p>
      )}
    </div>
  );
}
