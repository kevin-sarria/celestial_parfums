import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Modal from '../Modal';
import Estrellas from '../Estrellas';
import DistribucionEstrellas from './DistribucionEstrellas';
import ResenaItem from './ResenaItem';
import VisorImagenes from './VisorImagenes';
import { contarPorEstrella, type Resena } from './tipos';

interface Props {
  open: boolean;
  onClose: () => void;
  nombre: string;
  resenas: Resena[];
  promedio: number;
  total: number;
}

/** Modal de opiniones: resumen, distribución filtrable por estrellas y lista con carrusel de fotos. */
export default function ResenasModal({ open, onClose, nombre, resenas, promedio, total }: Props) {
  const [filtro, setFiltro] = useState(0);
  const [visor, setVisor] = useState<{ imgs: string[]; i: number } | null>(null);
  const conteo = useMemo(() => contarPorEstrella(resenas), [resenas]);
  const lista = filtro ? resenas.filter((r) => r.rating === filtro) : resenas;

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Opiniones · ${nombre}`} maxWidth={640} footer={null}>
        {/* Resumen: promedio + distribución filtrable */}
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center justify-center gap-1 sm:w-32">
            <span className="font-display text-5xl font-light leading-none text-ink">{promedio.toFixed(1)}</span>
            <Estrellas valor={promedio} size={16} />
            <span className="text-[12px] text-muted-foreground">{total} {total === 1 ? 'opinión' : 'opiniones'}</span>
          </div>
          <div className="flex-1">
            <DistribucionEstrellas conteo={conteo} total={total} filtro={filtro} onFiltro={setFiltro} />
          </div>
        </div>

        {filtro > 0 && (
          <button type="button" onClick={() => setFiltro(0)}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:text-primary/80">
            <RotateCcw className="size-3.5" /> Ver todas las opiniones
          </button>
        )}

        {/* Lista */}
        <div className="mt-1">
          {lista.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">No hay opiniones con esa calificación.</p>
          ) : (
            lista.map((r) => (
              <ResenaItem key={r.id} resena={r} onImagen={(imgs, i) => setVisor({ imgs, i })} />
            ))
          )}
        </div>
      </Modal>

      {visor && <VisorImagenes imagenes={visor.imgs} inicio={visor.i} onClose={() => setVisor(null)} />}
    </>
  );
}
