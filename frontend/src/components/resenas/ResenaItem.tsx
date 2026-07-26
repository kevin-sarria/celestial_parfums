import Estrellas from '../Estrellas';
import { fmtFechaResena, type Resena } from './tipos';

interface Props {
  resena: Resena;
  /** Abre el visor con las imágenes de ESTA reseña en el índice dado. */
  onImagen: (imagenes: string[], indice: number) => void;
}

/** Una reseña: autor, fecha, estrellas, comentario y miniaturas de fotos. */
export default function ResenaItem({ resena: r, onImagen }: Props) {
  return (
    <div className="border-b border-border/70 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <Estrellas valor={r.rating} size={14} />
        <span className="text-[11.5px] text-muted-foreground">{fmtFechaResena(r.fecha)}</span>
      </div>
      <p className="mt-1 text-[13px] font-medium text-foreground">{r.autor}</p>
      {r.comentario && <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{r.comentario}</p>}
      {r.imagenes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.imagenes.map((u, idx) => (
            <button key={u} type="button" onClick={() => onImagen(r.imagenes, idx)}
              className="overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.03]">
              <img src={u} alt="" className="size-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
