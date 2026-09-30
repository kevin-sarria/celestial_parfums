import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { useCatalogoCompleto } from '../../../../application/hooks/useCatalogoCompleto';
import type { Perfume } from '../../../../domain/entities/perfume.schema';
import type { Lookup, PerfumeForm } from '../../types';

/**
 * "Copiar la ficha de otro perfume": foto, descripción, notas, ocasiones,
 * género, duración y proyección, de un clic.
 *
 * Lo pidió el dueño con los originales (2026-09-29): si ya tiene el contratipo
 * de Khamrah con todo lleno, la ficha del Khamrah Original no tiene por qué
 * empezar en blanco. Sirve igual para cualquier ficha que comparta el jugo con
 * otra (un 1.1, un original creado a mano).
 *
 * Solo LLENA el formulario: nada se guarda hasta que él pulse Guardar, así que
 * puede revisar y corregir lo copiado. El nombre, los precios, las tallas y el
 * tipo no se tocan — eso es justo lo que distingue a las dos fichas. Lo que el
 * perfume de origen no tiene no borra lo que ya estaba escrito.
 */
export function CopiarFichaDe({ setForm, aromas, ocasiones, excluirId }: {
  setForm: React.Dispatch<React.SetStateAction<PerfumeForm>>;
  aromas: Lookup[];
  ocasiones: Lookup[];
  /** La ficha que se está editando: copiarse a sí misma no tiene sentido. */
  excluirId: number | null;
}) {
  const [abierto, setAbierto] = useState(false);
  // El catálogo se pide al abrirlo: casi ninguna edición lo necesita
  const { perfumes, error } = useCatalogoCompleto(abierto);

  const copiar = (origen: Perfume) => {
    const ids = (lista: Lookup[], nombres: string[]) => lista.filter(l => nombres.includes(l.nombre)).map(l => l.id);
    setForm(f => ({
      ...f,
      descripcion: origen.descripcion || f.descripcion,
      duracion: origen.duracion || f.duracion,
      proyeccion: origen.proyeccion || f.proyeccion,
      genero: origen.genero ?? f.genero,
      imagen_url: origen.imagen_url || f.imagen_url,
      tipos_aroma: origen.tipos_aroma.length ? ids(aromas, origen.tipos_aroma) : f.tipos_aroma,
      ocasiones: origen.ocasiones.length ? ids(ocasiones, origen.ocasiones) : f.ocasiones,
    }));
    setAbierto(false);
    toast.success(`Se copió la ficha de "${origen.nombre}". Revísala y guarda.`, { id: 'copiar-ficha' });
  };

  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setAbierto(true)}>
        <Copy className="size-4" /> Copiar ficha de otro perfume
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-secondary/40 p-2.5">
      <p className="mb-1.5 text-[12.5px] text-muted-foreground">
        Se copian la foto, la descripción, las notas, las ocasiones, el género, la duración y la
        proyección. El nombre, los precios y las tallas se quedan como están.
      </p>
      {error ? (
        <p className="text-[12.5px] text-destructive">No se pudo cargar el catálogo. Cierra y vuelve a intentar.</p>
      ) : (
        <BuscadorSelect
          opciones={(perfumes ?? [])
            .filter(p => p.id !== excluirId && !p.es_accesorio)
            .map(p => ({ id: p.id, nombre: p.nombre, nota: p.categoria ?? undefined }))}
          placeholder={perfumes ? '¿De cuál perfume copiar?' : 'Cargando catálogo…'}
          onSelect={id => {
            const origen = perfumes?.find(p => p.id === Number(id));
            if (origen) copiar(origen);
          }}
        />
      )}
      <button type="button" className="mt-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setAbierto(false)}>
        Cancelar
      </button>
    </div>
  );
}
